// Duplicate-detection service. Scans the current library and runs the
// pure matcher in shared/dedup against a candidate prompt body. Fully
// local - no network, no Gemini.

import { scanLibrary } from './library'
import { findDuplicates, type DuplicateMatch } from '../../shared/dedup'

export async function checkDuplicate(rawText: string): Promise<DuplicateMatch[]> {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) return []
  const prompts = await scanLibrary()
  return findDuplicates(
    rawText,
    prompts.map((p) => ({
      relPath: p.relPath,
      folder: p.folder,
      title: p.frontmatter.title,
      body: p.body
    }))
  )
}
