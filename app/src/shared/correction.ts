// Shape of a single correction event in <library-root>/.prompt-librarian/corrections.jsonl.
//
// Privacy: rawTextPreview is capped at the first 500 chars of the user's
// pasted prompt. The full body is NEVER recorded; rawTextHash (sha-256 of
// the full body) lets the pattern detector recognize duplicates without
// keeping the original. Absolute paths are NEVER recorded.

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
  return rawText.slice(0, RAW_TEXT_PREVIEW_MAX)
}
