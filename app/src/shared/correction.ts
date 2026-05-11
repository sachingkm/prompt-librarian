// Shape of a single correction event in <library-root>/.prompt-librarian/corrections.jsonl.
//
// Local-first storage: this app stores correction events on the user's
// own disk under .prompt-librarian. Because correction quality drives
// local learning, by default we record the full pasted prompt body in
// `rawText`. We also keep a bounded `rawTextPreview` for UI display and
// a `rawTextHash` (sha-256) for dedup. Absolute paths are NEVER recorded.
//
// Network/AI safety: Gemini few-shot only sends bounded snippets, not
// `rawText`. See app/src/main/services/classifier/index.ts.

export const CORRECTION_VERSION = 1
export const RAW_TEXT_PREVIEW_MAX = 500

export type CorrectionClassifierId = 'deterministic-v1' | 'ai-gemini-v1'
export type CorrectionProvider = 'deterministic' | 'gemini'

export interface CorrectionMetadata {
  title: string
  category: string
  subcategory: string
  tags: string[]
  reuse: string
  scope: string
  recommendedFolder: string
  filename: string
}

export type CorrectionField = keyof CorrectionMetadata

export interface CorrectionSignals {
  matchedKeywords: string[]
  matchedTriggers: string[]
}

export interface Correction {
  version: number
  timestamp: string
  // Full local prompt body. Stored on the user's disk only. Older
  // correction records may omit this; consumers should fall back to
  // rawTextPreview when rawText is undefined.
  rawText?: string
  // Bounded snippet for UI display and for Gemini few-shot examples.
  rawTextPreview: string
  rawTextHash: string
  classifierId: CorrectionClassifierId
  provider: CorrectionProvider
  suggested: CorrectionMetadata
  accepted: CorrectionMetadata
  changedFields: CorrectionField[]
  signals: CorrectionSignals
}

export const CORRECTION_FIELDS: CorrectionField[] = [
  'title',
  'category',
  'subcategory',
  'tags',
  'reuse',
  'scope',
  'recommendedFolder',
  'filename'
]

// Deep equality for the bits we actually compare. Tags compared as sorted
// lower-case sets so order/case don't produce false positives.
export function metadataChangedFields(
  suggested: CorrectionMetadata,
  accepted: CorrectionMetadata
): CorrectionField[] {
  const out: CorrectionField[] = []
  for (const f of CORRECTION_FIELDS) {
    if (f === 'tags') {
      const a = [...suggested.tags].map((t) => t.toLowerCase()).sort()
      const b = [...accepted.tags].map((t) => t.toLowerCase()).sort()
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) out.push('tags')
      continue
    }
    if (suggested[f] !== accepted[f]) out.push(f)
  }
  return out
}

export function clampPreview(rawText: string): string {
  if (typeof rawText !== 'string') return ''
  const normalized = rawText.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 1) return ''
  const suffix = '...'
  const hardLimit = Math.max(0, RAW_TEXT_PREVIEW_MAX - suffix.length)
  const target =
    normalized.length > RAW_TEXT_PREVIEW_MAX
      ? hardLimit
      : Math.min(normalized.length - 1, Math.max(12, Math.floor(normalized.length * 0.6)))
  if (target <= 0) return ''
  const boundary = normalized.lastIndexOf(' ', target)
  const keep = boundary >= 12 ? boundary : target
  return normalized.slice(0, keep).trimEnd() + suffix
}
