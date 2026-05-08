// Vitest spec for the deterministic classifier. Runs against the
// FIXTURES list with DEFAULT_CLASSIFIER_RULES, plus a handful of targeted
// scenarios for custom rules, negativeKeywords, priority, and archive
// avoidance.

import { describe, expect, it } from 'vitest'
import {
  CLASSIFIER_RULES_VERSION,
  ClassifierRules,
  DEFAULT_CLASSIFIER_RULES,
  collectRuleFolders,
  listEnabledCategoryLabels
} from '../../../../shared/classifierRules'
import type { ClassificationInput } from '../../../../shared/classifier'
import { classifyDeterministic, windowsSafeSlug } from './classifier'
import { FIXTURES } from './fixtures'

function input(text: string, rules: ClassifierRules = DEFAULT_CLASSIFIER_RULES): ClassificationInput {
  return {
    rawText: text,
    rules,
    allowedFolders: collectRuleFolders(rules),
    allowedCategories: listEnabledCategoryLabels(rules)
  }
}

describe('deterministic classifier - default rules fixtures', () => {
  for (const fx of FIXTURES) {
    it(`${fx.name} -> ${fx.expectedFolder}`, () => {
      const r = classifyDeterministic(input(fx.text))
      expect(r.recommendedFolder, JSON.stringify(r, null, 2)).toBe(fx.expectedFolder)
      expect(r.category).toBe(fx.expectedCategory)
      if (fx.expectedTier) expect(r.confidence.tier).toBe(fx.expectedTier)
      if (fx.expectedReuse) expect(r.reuse).toBe(fx.expectedReuse)
      if (fx.expectedScope) expect(r.scope).toBe(fx.expectedScope)
      if (fx.expectedTagsAny) {
        const lower = r.tags.map((t) => t.toLowerCase())
        expect(
          fx.expectedTagsAny.some((t) => lower.includes(t.toLowerCase())),
          `expected one of ${fx.expectedTagsAny.join(', ')} in ${JSON.stringify(r.tags)}`
        ).toBe(true)
      }
      if (fx.forbidFolder) {
        expect(r.recommendedFolder).not.toBe(fx.forbidFolder)
      }
    })
  }
})

describe('deterministic classifier - custom rules', () => {
  it('custom category outside defaults can win', () => {
    const customRules: ClassifierRules = {
      version: CLASSIFIER_RULES_VERSION,
      categories: [
        ...DEFAULT_CLASSIFIER_RULES.categories,
        {
          id: 'sql-snippets',
          label: 'SQL snippets',
          folder: '07-SQL',
          enabled: true,
          priority: 1, // beats defaults priority 0
          keywords: [
            { term: 'sql', weight: 3 },
            { term: 'group by', weight: 2 },
            { term: 'window function', weight: 3 }
          ],
          tags: ['sql']
        }
      ],
      projects: DEFAULT_CLASSIFIER_RULES.projects,
      fallback: DEFAULT_CLASSIFIER_RULES.fallback,
      scoring: DEFAULT_CLASSIFIER_RULES.scoring,
      reuseDefaults: DEFAULT_CLASSIFIER_RULES.reuseDefaults
    }
    const r = classifyDeterministic(
      input('Write a SQL query that uses GROUP BY and a window function.', customRules)
    )
    expect(r.recommendedFolder).toBe('07-SQL')
    expect(r.category).toBe('SQL snippets')
    expect(r.tags).toContain('sql')
  })

  it('negativeKeyword suppresses an otherwise winning category', () => {
    // Take a copy of Core Transforms and add "classifier" as a negative.
    const rules: ClassifierRules = JSON.parse(
      JSON.stringify(DEFAULT_CLASSIFIER_RULES)
    ) as ClassifierRules
    const core = rules.categories.find((c) => c.id === 'core-transforms')!
    core.negativeKeywords = ['classifier']

    // "transcript" matches Core Transforms for +3, but "classifier" as
    // a negative subtracts the default 3-point penalty, dropping the rule
    // to score=0 which suppresses it. No other category matches.
    const r = classifyDeterministic(
      input(
        'I want to extend the prompt classifier to handle transcripts.',
        rules
      )
    )
    expect(r.recommendedFolder).not.toBe('01-Core Transforms')
    expect(r.reasoning.suppressedBy ?? []).toContain('Core Transforms')
  })

  it('project priority 5 trigger beats a higher-scoring category', () => {
    // Career Buddy has priority 5 and trigger "Career Buddy".
    // Build a prompt full of transcript keywords plus the trigger.
    const r = classifyDeterministic(
      input(
        'For Career Buddy: transcript transcript transcript with multiple speakers and timestamps.'
      )
    )
    expect(r.recommendedFolder).toBe('06-Project Prompts/Career Buddy')
    expect(r.category).toBe('Career Buddy')
    expect(r.reasoning.matchedTriggers ?? []).toContain('Career Buddy')
  })

  it('disabled category falls through to next-best rule', () => {
    const rules: ClassifierRules = JSON.parse(
      JSON.stringify(DEFAULT_CLASSIFIER_RULES)
    ) as ClassifierRules
    const core = rules.categories.find((c) => c.id === 'core-transforms')!
    core.enabled = false
    // Same prompt as transcript-to-dialogue fixture.
    const r = classifyDeterministic(
      input(
        'Clean up this transcript. Remove [inaudible], collapse filler words, and produce a clean speaker-attributed dialogue with timestamps.',
        rules
      )
    )
    expect(r.recommendedFolder).not.toBe('01-Core Transforms')
  })

  it('archive folder is never selected for a typical new prompt under defaults', () => {
    for (const fx of FIXTURES) {
      const r = classifyDeterministic(input(fx.text))
      expect(r.recommendedFolder.startsWith('99-Archive')).toBe(false)
    }
  })

  it('rule referencing a missing folder still classifies but adds a note', () => {
    const rules: ClassifierRules = JSON.parse(
      JSON.stringify(DEFAULT_CLASSIFIER_RULES)
    ) as ClassifierRules
    const sub = rules.categories[0].subcategories?.[0]
    if (sub) sub.folder = '07-Brand-New-Folder'
    const r = classifyDeterministic({
      ...input(
        'Clean up this transcript and remove inaudible markers.',
        rules
      ),
      // Pretend on-disk folders are only the defaults excluding the new sub.
      allowedFolders: collectRuleFolders(DEFAULT_CLASSIFIER_RULES)
    })
    // The sub fires (matches "inaudible") and recommended folder is the
    // not-yet-on-disk folder, with a reasoning note about it.
    expect(r.recommendedFolder).toBe('07-Brand-New-Folder')
    expect(r.reasoning.notes.some((n) => n.includes('not present'))).toBe(true)
  })
})

describe('windowsSafeSlug', () => {
  it('replaces invalid chars and collapses dashes', () => {
    expect(windowsSafeSlug('Hello: World? <foo>')).toBe('hello-world-foo')
  })
  it('handles reserved Windows names', () => {
    expect(windowsSafeSlug('CON')).toBe('con-prompt')
    expect(windowsSafeSlug('com1')).toBe('com1-prompt')
  })
  it('falls back when input is empty', () => {
    expect(windowsSafeSlug('')).toBe('untitled-prompt')
  })
  it('strips trailing space and dot', () => {
    expect(windowsSafeSlug('hello. ')).toBe('hello')
  })
  it('caps length at 80', () => {
    const longTitle = 'a'.repeat(120)
    const slug = windowsSafeSlug(longTitle)
    expect(slug.length).toBeLessThanOrEqual(80)
  })
})
