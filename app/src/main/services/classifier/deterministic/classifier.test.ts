// Vitest spec for the deterministic classifier. Most fixtures run against
// TEST_CLASSIFIER_RULES (a richer taxonomy) so engine coverage stays
// intact while the shipped DEFAULT_CLASSIFIER_RULES is intentionally
// minimal in Phase 4B.

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
import { FIXTURES, TEST_CLASSIFIER_RULES } from './fixtures'

function input(
  text: string,
  rules: ClassifierRules = TEST_CLASSIFIER_RULES
): ClassificationInput {
  return {
    rawText: text,
    rules,
    allowedFolders: collectRuleFolders(rules),
    allowedCategories: listEnabledCategoryLabels(rules)
  }
}

describe('deterministic classifier - test rules fixtures', () => {
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

describe('deterministic classifier - DEFAULT (minimal) rules', () => {
  it('routes a transcript prompt into Transform / Transcript Cleanup', () => {
    const r = classifyDeterministic(
      input(
        'Clean up this transcript. Remove [inaudible] markers, attribute speakers and timestamps.',
        DEFAULT_CLASSIFIER_RULES
      )
    )
    expect(r.category).toBe('Transform')
    expect(r.recommendedFolder).toBe('01-Transform/Transcript Cleanup')
  })

  it('routes a generic create prompt into Create', () => {
    const r = classifyDeterministic(
      input('Draft a short product update email.', DEFAULT_CLASSIFIER_RULES)
    )
    expect(r.category).toBe('Create')
  })

  it('routes a no-match prompt to fallback', () => {
    const r = classifyDeterministic(input('Tell me a joke.', DEFAULT_CLASSIFIER_RULES))
    expect(r.recommendedFolder).toBe('00-Index')
    expect(r.category).toBe('Uncategorized')
  })
})

describe('deterministic classifier - custom rules', () => {
  it('custom category outside defaults can win', () => {
    const customRules: ClassifierRules = {
      version: CLASSIFIER_RULES_VERSION,
      categories: [
        ...TEST_CLASSIFIER_RULES.categories,
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
      projects: TEST_CLASSIFIER_RULES.projects,
      fallback: TEST_CLASSIFIER_RULES.fallback,
      scoring: TEST_CLASSIFIER_RULES.scoring,
      reuseDefaults: TEST_CLASSIFIER_RULES.reuseDefaults
    }
    const r = classifyDeterministic(
      input('Write a SQL query that uses GROUP BY and a window function.', customRules)
    )
    expect(r.recommendedFolder).toBe('07-SQL')
    expect(r.category).toBe('SQL snippets')
    expect(r.tags).toContain('sql')
  })

  it('negativeKeyword suppresses an otherwise winning category', () => {
    const rules: ClassifierRules = JSON.parse(
      JSON.stringify(TEST_CLASSIFIER_RULES)
    ) as ClassifierRules
    const core = rules.categories.find((c) => c.id === 'core-transforms')!
    core.negativeKeywords = ['classifier']

    const r = classifyDeterministic(
      input('I want to extend the prompt classifier to handle transcripts.', rules)
    )
    expect(r.recommendedFolder).not.toBe('01-Core Transforms')
    expect(r.reasoning.suppressedBy ?? []).toContain('Core Transforms')
  })

  it('project priority 5 trigger beats a higher-scoring category', () => {
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
      JSON.stringify(TEST_CLASSIFIER_RULES)
    ) as ClassifierRules
    const core = rules.categories.find((c) => c.id === 'core-transforms')!
    core.enabled = false
    const r = classifyDeterministic(
      input(
        'Clean up this transcript. Remove [inaudible], collapse filler words, and produce a clean speaker-attributed dialogue with timestamps.',
        rules
      )
    )
    expect(r.recommendedFolder).not.toBe('01-Core Transforms')
  })

  it('archive folder is never selected for any fixture', () => {
    for (const fx of FIXTURES) {
      const r = classifyDeterministic(input(fx.text))
      expect(r.recommendedFolder.startsWith('99-Archive')).toBe(false)
    }
  })

  it('rule referencing a missing folder still classifies but adds a note', () => {
    const rules: ClassifierRules = JSON.parse(
      JSON.stringify(TEST_CLASSIFIER_RULES)
    ) as ClassifierRules
    const sub = rules.categories[0].subcategories?.[0]
    if (sub) sub.folder = '07-Brand-New-Folder'
    const r = classifyDeterministic({
      ...input('Clean up this transcript and remove inaudible markers.', rules),
      allowedFolders: collectRuleFolders(TEST_CLASSIFIER_RULES)
    })
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
