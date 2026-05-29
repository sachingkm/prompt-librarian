// Local, offline duplicate detection for prompt bodies. Pure and
// renderer-safe: no Node, no Electron, no crypto. Used by main (against
// the scanned library) and importable by the renderer if needed.
//
// Two tiers, both local:
//   - exact: normalized bodies are byte-identical
//   - near:  word-set (Jaccard) similarity >= NEAR_DUPLICATE_THRESHOLD
//
// We use word-SET Jaccard rather than n-gram shingles on purpose. Shingles
// are precise about word order but brittle: a single inserted word can drop
// the score below threshold, so genuine "same prompt, light edit" cases get
// missed. Word-set Jaccard is robust to small edits and reordering, which is
// what duplicate detection actually cares about. The cost is that it ignores
// word order - acceptable here, since a reordered prompt is still a dup.
//
// Semantic ("same intent, different words") is intentionally NOT handled
// here - that needs embeddings and belongs to the future search phase.

export const NEAR_DUPLICATE_THRESHOLD = 0.8

export interface DuplicateMatch {
  relPath: string
  folder: string
  title: string
  matchType: 'exact' | 'near'
  // 0..1 Jaccard similarity. Exact matches report 1.
  similarity: number
}

// Minimal shape the matcher needs from an existing prompt.
export interface ExistingPromptBody {
  relPath: string
  folder: string
  title: string
  body: string
}

// Normalize a body for comparison: unify line endings, collapse all
// whitespace runs to a single space, trim. Case is preserved on purpose -
// casing can be meaningful in a prompt, and re-pastes preserve it anyway.
export function normalizeBody(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim()
}

// Lower-cased word set. Lower-casing is for comparison robustness only -
// the stored body and preview keep their original case elsewhere.
function wordSet(normalized: string): Set<string> {
  const out = new Set<string>()
  for (const t of normalized.toLowerCase().split(' ')) {
    if (t.length > 0) out.add(t)
  }
  return out
}

// Word-set Jaccard similarity. Returns 1 for normalized-equal bodies
// (including two empty bodies), 0 when there is no overlap.
export function similarity(a: string, b: string): number {
  const na = normalizeBody(a)
  const nb = normalizeBody(b)
  if (na === nb) return 1
  if (na.length === 0 || nb.length === 0) return 0
  const sa = wordSet(na)
  const sb = wordSet(nb)
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const s of sa) if (sb.has(s)) inter += 1
  const union = sa.size + sb.size - inter
  return union === 0 ? 0 : inter / union
}

// Find existing prompts whose body matches rawText at or above the
// near-duplicate threshold. Sorted most-similar first; exact matches lead.
export function findDuplicates(
  rawText: string,
  existing: ExistingPromptBody[]
): DuplicateMatch[] {
  if (typeof rawText !== 'string' || normalizeBody(rawText).length === 0) return []
  const normalizedInput = normalizeBody(rawText)
  const matches: DuplicateMatch[] = []
  for (const p of existing) {
    const sim = similarity(rawText, p.body)
    if (sim >= NEAR_DUPLICATE_THRESHOLD) {
      // "exact" means the normalized bodies are byte-identical. A reorder
      // can score 1.0 on Jaccard but is reported as "near".
      const exact = normalizedInput === normalizeBody(p.body)
      matches.push({
        relPath: p.relPath,
        folder: p.folder,
        title: p.title,
        matchType: exact ? 'exact' : 'near',
        similarity: sim
      })
    }
  }
  // Exact matches first, then by descending similarity.
  matches.sort((a, b) => {
    if (a.matchType !== b.matchType) return a.matchType === 'exact' ? -1 : 1
    return b.similarity - a.similarity
  })
  return matches
}
