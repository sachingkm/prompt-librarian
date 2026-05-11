// CorrectionsService - append-only JSONL of user corrections.
//
// Local-first storage:
// - This app keeps corrections on the user's own disk under
//   .prompt-librarian. By default, each correction stores the FULL
//   prompt body (`rawText`) so local learning (pattern detection,
//   future on-device retrieval) has real text to work with.
// - We also keep `rawTextPreview` (bounded snippet) for UI display and
//   for sending to Gemini as few-shot examples. Gemini few-shot does
//   NOT use `rawText`.
// - `rawTextHash` (sha-256) provides dedup without comparing strings.
// - No absolute paths are written.
// - User can clear the entire history at any time via clearCorrections.
//
// File format: one JSON object per line. A malformed line is logged via
// the warning callback and skipped, never crashes load.

import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import {
  CORRECTION_VERSION,
  Correction,
  CorrectionClassifierId,
  CorrectionMetadata,
  CorrectionProvider,
  CORRECTION_FIELDS,
  clampPreview,
  metadataChangedFields
} from '../../shared/correction'

const META_DIR = '.prompt-librarian'
const FILE = 'corrections.jsonl'

export function correctionsPath(libraryRoot: string): string {
  return join(libraryRoot, META_DIR, FILE)
}

export interface BuildCorrectionInput {
  rawText: string
  classifierId: CorrectionClassifierId
  provider: CorrectionProvider
  suggested: CorrectionMetadata
  accepted: CorrectionMetadata
  matchedKeywords?: string[]
  matchedTriggers?: string[]
}

export function buildCorrection(input: BuildCorrectionInput): Correction | null {
  const changedFields = metadataChangedFields(input.suggested, input.accepted)
  if (changedFields.length === 0) return null
  const rawText = typeof input.rawText === 'string' ? input.rawText : ''
  return {
    version: CORRECTION_VERSION,
    timestamp: new Date().toISOString(),
    // Local-first: keep the full body for local pattern detection. This
    // stays on the user's disk; it is never sent to Gemini.
    rawText,
    rawTextPreview: clampPreview(rawText),
    rawTextHash: sha256(rawText),
    classifierId: input.classifierId,
    provider: input.provider,
    suggested: { ...input.suggested },
    accepted: { ...input.accepted },
    changedFields,
    signals: {
      matchedKeywords: [...(input.matchedKeywords ?? [])],
      matchedTriggers: [...(input.matchedTriggers ?? [])]
    }
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

async function ensureMetaDir(libraryRoot: string): Promise<void> {
  await fs.mkdir(join(libraryRoot, META_DIR), { recursive: true })
}

// Append + fsync. The file uses LF endings (jsonl convention) regardless
// of platform.
export async function appendCorrection(
  libraryRoot: string,
  correction: Correction
): Promise<void> {
  await ensureMetaDir(libraryRoot)
  const file = correctionsPath(libraryRoot)
  const line = JSON.stringify(correction) + '\n'
  const fh = await fs.open(file, 'a')
  try {
    await fh.writeFile(line, 'utf8')
    await fh.sync()
  } finally {
    await fh.close()
  }
}

export interface LoadedCorrections {
  corrections: Correction[]
  malformedLineCount: number
}

export async function loadCorrections(libraryRoot: string): Promise<LoadedCorrections> {
  const file = correctionsPath(libraryRoot)
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') return { corrections: [], malformedLineCount: 0 }
    throw err
  }
  const out: Correction[] = []
  let malformed = 0
  for (const line of raw.split(/\r?\n/)) {
    if (line.length === 0) continue
    try {
      const parsed = JSON.parse(line)
      if (parsed && typeof parsed === 'object' && parsed.version === CORRECTION_VERSION) {
        out.push(parsed as Correction)
      } else {
        malformed += 1
      }
    } catch {
      malformed += 1
    }
  }
  return { corrections: out, malformedLineCount: malformed }
}

export async function clearCorrections(libraryRoot: string): Promise<void> {
  try {
    await fs.unlink(correctionsPath(libraryRoot))
  } catch {
    // ignore: nothing to clear
  }
}

// Defensive sanitizer for accepted/suggested objects coming from IPC. We
// never trust the renderer to send well-formed metadata.
export function sanitizeMetadata(input: unknown): CorrectionMetadata {
  const m = (input as Record<string, unknown>) ?? {}
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s) => typeof s === 'string').map((s) => s as string) : []
  return {
    title: str(m.title),
    category: str(m.category),
    subcategory: str(m.subcategory),
    tags: arr(m.tags),
    reuse: str(m.reuse),
    scope: str(m.scope),
    recommendedFolder: str(m.recommendedFolder),
    filename: str(m.filename)
  }
}

// Small accessor for tests / few-shot builder.
export const _internal = { CORRECTION_FIELDS }
