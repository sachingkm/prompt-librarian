// Pure, deterministic classifier. No I/O, no Date.now(), no network.
// Reads rules from input.rules - never hardcodes folder/category labels
// or keywords. Same input -> same output, always.

import type {
  ClassificationAlternative,
  ClassificationInput,
  ClassificationResult,
  Classifier,
  ConfidenceTier,
  ReuseLevel,
  Scope
} from '../../../../shared/classifier'
import { scoreTier } from '../../../../shared/classifier'
import {
  ClassifierRuleCategory,
  ClassifierRuleProject,
  ClassifierRuleSubcategory,
  DEFAULT_NEGATIVE_KEYWORD_PENALTY
} from '../../../../shared/classifierRules'

const ARCHIVE_PREFIX = '99-Archive'

// Internal type, never exits this module.
interface CategoryScored {
  category: ClassifierRuleCategory
  score: number // post-penalty
  rawScore: number // pre-penalty, for "suppressed" detection
  matchedKeywords: string[]
  hitNegatives: string[]
  bestSub: ClassifierRuleSubcategory | null
  subScore: number
  subMatched: string[]
}

interface ProjectScored {
  project: ClassifierRuleProject
  matchedTriggers: string[]
  hitNegatives: string[]
  // Project rules at priority >= 5 act as exact-phrase triggers; their
  // numeric score is binary in spirit (matched or not), with negative
  // penalty subtracted. We still expose a score so tie-break math works.
  score: number
}

function lower(s: string): string {
  return s.toLowerCase()
}

function containsAll(haystack: string, needles: string[]): string[] {
  const matched: string[] = []
  for (const n of needles) {
    if (n.length === 0) continue
    if (haystack.includes(n.toLowerCase())) matched.push(n)
  }
  return matched
}

function scoreCategory(text: string, cat: ClassifierRuleCategory): CategoryScored {
  const matchedKeywords: string[] = []
  let raw = 0
  for (const kw of cat.keywords ?? []) {
    if (text.includes(kw.term.toLowerCase())) {
      raw += kw.weight
      matchedKeywords.push(kw.term)
    }
  }
  const hitNegatives = containsAll(text, cat.negativeKeywords ?? [])
  const score = raw - hitNegatives.length * DEFAULT_NEGATIVE_KEYWORD_PENALTY

  // Best subcategory by score. Ties go to first defined.
  let bestSub: ClassifierRuleSubcategory | null = null
  let subScore = 0
  let subMatched: string[] = []
  for (const sub of cat.subcategories ?? []) {
    if (sub.enabled === false) continue
    const matched: string[] = []
    let s = 0
    for (const kw of sub.keywords ?? []) {
      if (text.includes(kw.term.toLowerCase())) {
        s += kw.weight
        matched.push(kw.term)
      }
    }
    const subNegs = containsAll(text, sub.negativeKeywords ?? [])
    const finalSubScore = s - subNegs.length * DEFAULT_NEGATIVE_KEYWORD_PENALTY
    if (finalSubScore > subScore) {
      subScore = finalSubScore
      bestSub = sub
      subMatched = matched
    }
  }

  return {
    category: cat,
    score,
    rawScore: raw,
    matchedKeywords,
    hitNegatives,
    bestSub,
    subScore,
    subMatched
  }
}

function scoreProject(text: string, proj: ClassifierRuleProject): ProjectScored {
  const triggers = (proj.triggers ?? []).filter((t) => text.includes(t.toLowerCase()))
  const hitNegatives = containsAll(text, proj.negativeKeywords ?? [])
  // 100 is an internal sentinel weight - large enough to dominate any
  // sane category sum. We expose only normalized 0..1 scores externally.
  const baseline = triggers.length > 0 ? 100 : 0
  const score = Math.max(0, baseline - hitNegatives.length * DEFAULT_NEGATIVE_KEYWORD_PENALTY)
  return { project: proj, matchedTriggers: triggers, hitNegatives, score }
}

function inferTitle(rawText: string): string {
  // Use the first non-empty line, strip leading markdown punctuation,
  // clamp to 60 chars at a word boundary if possible.
  const lines = rawText.split(/\r?\n/)
  let line = ''
  for (const l of lines) {
    const t = l.trim()
    if (t.length > 0) {
      line = t
      break
    }
  }
  line = line.replace(/^#+\s+/, '').replace(/^\*+\s+/, '').replace(/^>\s+/, '')
  // Drop trailing punctuation noise.
  line = line.replace(/[.!?;:,]+$/, '')
  if (line.length === 0) return 'Untitled prompt'
  if (line.length <= 60) return line
  const slice = line.slice(0, 60)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > 30 ? slice.slice(0, lastSpace) : slice).trim()
}

const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
])

export function windowsSafeSlug(input: string): string {
  let slug = input.toLowerCase()
  // Replace invalid Windows filename chars + whitespace with hyphens.
  slug = slug.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, '-')
  // Collapse + trim
  slug = slug.replace(/-+/g, '-').replace(/^-|-$/g, '')
  // Strip trailing dots/spaces (Windows refuses).
  slug = slug.replace(/[\s.]+$/, '')
  if (slug.length === 0) slug = 'untitled-prompt'
  if (WINDOWS_RESERVED.has(slug.toUpperCase())) slug = `${slug}-prompt`
  // Cap length so Windows max-path stays comfortable.
  if (slug.length > 80) slug = slug.slice(0, 80).replace(/-+$/, '')
  return slug
}

function inferReuse(text: string, rules: ClassificationInput['rules']): ReuseLevel {
  const high = rules.reuseDefaults.highPhrases.some((p) => text.includes(p.toLowerCase()))
  if (high) return 'high'
  const low = rules.reuseDefaults.lowPhrases.some((p) => text.includes(p.toLowerCase()))
  if (low) return 'low'
  return 'medium'
}

function reuseToScope(reuse: ReuseLevel): Scope {
  return reuse === 'low' ? 'one-off' : 'reusable'
}

function dedupeLower(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const i of items) {
    const k = i.toLowerCase()
    if (k.length === 0) continue
    if (seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

// Map an internal raw score to a 0..1 "confidence". Linear with a cap so
// the rules-file thresholds (default highTier=0.7, mediumTier=0.4) align
// with intuitive raw counts. 8+ raw = saturated 1.0 (clearly high), 6
// raw = 0.75 (high), 4 raw = 0.5 (medium), 2 raw = 0.25 (low). The cap
// is intentional: stacking many weak keywords shouldn't ride higher than
// a single strong-trigger match.
function normalizeScore(raw: number): number {
  if (raw <= 0) return 0
  return Math.max(0, Math.min(1, raw / 8))
}

export function classifyDeterministic(input: ClassificationInput): ClassificationResult {
  const text = lower(input.rawText)
  const { rules, allowedFolders } = input
  const allowedFolderSet = new Set(allowedFolders)

  // 1. Score project triggers (priority >= 5 act as overrides).
  const projectsScored = rules.projects
    .filter((p) => p.enabled !== false)
    .map((p) => ({ score: scoreProject(text, p), priority: p.priority ?? 5 }))
  const winningProject = projectsScored
    .filter((p) => p.score.score > 0 && p.priority >= 5)
    .sort((a, b) => b.priority - a.priority || b.score.score - a.score.score)[0]

  // 2. Score categories.
  const catsScored = rules.categories
    .filter((c) => c.enabled !== false)
    .map((c) => scoreCategory(text, c))

  const suppressedBy: string[] = []
  for (const c of catsScored) {
    if (c.rawScore > 0 && c.score <= 0) suppressedBy.push(c.category.label)
  }

  const liveCats = catsScored
    .filter((c) => c.score > 0)
    .sort(
      (a, b) =>
        (b.category.priority ?? 0) - (a.category.priority ?? 0) || b.score - a.score
    )

  // 3. Decide winner.
  let winnerLabel: string
  let winnerSubLabel: string | undefined
  let winnerFolder: string
  let winnerTags: string[]
  let matchedKeywords: string[]
  let matchedTriggers: string[]
  let rawScoreForConfidence: number

  if (winningProject) {
    const p = winningProject.score.project
    winnerLabel = p.label
    winnerSubLabel = undefined
    winnerFolder = p.folder
    winnerTags = p.tags ?? []
    matchedKeywords = []
    matchedTriggers = winningProject.score.matchedTriggers
    // Triggers should always be high-confidence by design.
    rawScoreForConfidence = 100
  } else if (liveCats.length > 0) {
    const top = liveCats[0]
    const c = top.category
    winnerLabel = c.label
    winnerSubLabel = top.bestSub?.label
    winnerFolder = top.bestSub?.folder ?? c.folder
    winnerTags = [...(c.tags ?? []), ...(top.bestSub?.tags ?? [])]
    matchedKeywords = [...top.matchedKeywords, ...top.subMatched]
    matchedTriggers = []
    rawScoreForConfidence = top.score + top.subScore
  } else {
    winnerLabel = rules.fallback.label
    winnerSubLabel = undefined
    winnerFolder = rules.fallback.folder
    winnerTags = []
    matchedKeywords = []
    matchedTriggers = []
    rawScoreForConfidence = 0
  }

  // 4. Notes & alternatives.
  const notes: string[] = []
  if (winnerFolder.startsWith(ARCHIVE_PREFIX)) {
    notes.push(
      `Recommended folder is the archive (${winnerFolder}); archive is rarely correct for new prompts.`
    )
  }
  if (allowedFolderSet.size > 0 && !allowedFolderSet.has(winnerFolder)) {
    notes.push(
      `Recommended folder "${winnerFolder}" is not present in the current library; it will be created on save.`
    )
  }
  if (rawScoreForConfidence === 0) {
    notes.push('No rule matched the prompt strongly. Falling back to default folder.')
  }

  const alternatives: ClassificationAlternative[] = liveCats
    .slice(winningProject ? 0 : 1, winningProject ? 3 : 4)
    .map((c) => ({
      folder: c.bestSub?.folder ?? c.category.folder,
      score: normalizeScore(c.score + c.subScore)
    }))

  // 5. Title / filename / tags / reuse.
  const title = inferTitle(input.rawText)
  const filename = windowsSafeSlug(title) + '.md'

  const tags = dedupeLower([
    ...matchedKeywords,
    ...matchedTriggers,
    ...winnerTags
  ]).slice(0, 8)

  const reuse = inferReuse(text, rules)
  const scope = reuseToScope(reuse)

  const score = normalizeScore(rawScoreForConfidence)
  const tier: ConfidenceTier = scoreTier(score, rules.scoring)

  return {
    classifierId: 'deterministic-v1',
    provider: 'deterministic',
    title,
    category: winnerLabel,
    subcategory: winnerSubLabel,
    tags,
    reuse,
    scope,
    recommendedFolder: winnerFolder,
    filename,
    confidence: { score, tier },
    reasoning: {
      matchedKeywords,
      matchedTriggers,
      suppressedBy,
      topAlternatives: alternatives,
      notes
    }
  }
}

export const deterministicClassifier: Classifier = {
  id: 'deterministic-v1',
  provider: 'deterministic',
  classify(input) {
    return Promise.resolve(classifyDeterministic(input))
  }
}
