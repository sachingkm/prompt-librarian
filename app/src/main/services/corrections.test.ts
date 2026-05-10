// Tests for CorrectionsService. Uses a temp directory so we don't touch
// the user's library.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendCorrection,
  buildCorrection,
  clearCorrections,
  correctionsPath,
  loadCorrections,
  sanitizeMetadata
} from './corrections'
import {
  CORRECTION_VERSION,
  CorrectionMetadata,
  RAW_TEXT_PREVIEW_MAX
} from '../../shared/correction'

let tmp = ''

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pl-corrections-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const baseSuggested: CorrectionMetadata = {
  title: 'Original',
  category: 'Transform',
  subcategory: '',
  tags: ['a', 'b'],
  reuse: 'medium',
  scope: 'reusable',
  recommendedFolder: '01-Transform',
  filename: 'foo.md'
}

describe('buildCorrection', () => {
  it('returns null when nothing changed', () => {
    const c = buildCorrection({
      rawText: 'hello',
      classifierId: 'deterministic-v1',
      provider: 'deterministic',
      suggested: baseSuggested,
      accepted: { ...baseSuggested }
    })
    expect(c).toBeNull()
  })

  it('records changedFields when title and folder differ', () => {
    const c = buildCorrection({
      rawText: 'hello',
      classifierId: 'deterministic-v1',
      provider: 'deterministic',
      suggested: baseSuggested,
      accepted: { ...baseSuggested, title: 'Edited', recommendedFolder: '02-Create' }
    })
    expect(c).not.toBeNull()
    expect(c!.changedFields).toEqual(expect.arrayContaining(['title', 'recommendedFolder']))
    expect(c!.version).toBe(CORRECTION_VERSION)
  })

  it('caps rawTextPreview and stores a hash, never the full body', () => {
    const huge = 'x'.repeat(2000)
    const c = buildCorrection({
      rawText: huge,
      classifierId: 'deterministic-v1',
      provider: 'deterministic',
      suggested: baseSuggested,
      accepted: { ...baseSuggested, title: 'Edited' }
    })
    expect(c).not.toBeNull()
    expect(c!.rawTextPreview.length).toBeLessThanOrEqual(RAW_TEXT_PREVIEW_MAX)
    expect(c!.rawTextPreview).not.toContain(huge)
    expect(c!.rawTextHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('considers tag set equality regardless of order/case', () => {
    const c = buildCorrection({
      rawText: 'hello',
      classifierId: 'deterministic-v1',
      provider: 'deterministic',
      suggested: { ...baseSuggested, tags: ['A', 'B'] },
      accepted: { ...baseSuggested, tags: ['b', 'a'] }
    })
    expect(c).toBeNull()
  })
})

describe('appendCorrection / loadCorrections', () => {
  it('round-trips a single correction', async () => {
    const c = buildCorrection({
      rawText: 'hi',
      classifierId: 'deterministic-v1',
      provider: 'deterministic',
      suggested: baseSuggested,
      accepted: { ...baseSuggested, title: 'Edit' }
    })
    expect(c).not.toBeNull()
    await appendCorrection(tmp, c!)
    const loaded = await loadCorrections(tmp)
    expect(loaded.corrections.length).toBe(1)
    expect(loaded.malformedLineCount).toBe(0)
    expect(loaded.corrections[0].changedFields).toContain('title')
  })

  it('skips malformed lines and reports the count', async () => {
    const c = buildCorrection({
      rawText: 'hi',
      classifierId: 'deterministic-v1',
      provider: 'deterministic',
      suggested: baseSuggested,
      accepted: { ...baseSuggested, title: 'Edit' }
    })
    await appendCorrection(tmp, c!)
    // Append a garbage line manually.
    const file = correctionsPath(tmp)
    await fs.appendFile(file, 'this is not json\n')
    const loaded = await loadCorrections(tmp)
    expect(loaded.corrections.length).toBe(1)
    expect(loaded.malformedLineCount).toBeGreaterThanOrEqual(1)
  })

  it('clearCorrections removes the file', async () => {
    const c = buildCorrection({
      rawText: 'hi',
      classifierId: 'deterministic-v1',
      provider: 'deterministic',
      suggested: baseSuggested,
      accepted: { ...baseSuggested, title: 'Edit' }
    })
    await appendCorrection(tmp, c!)
    await clearCorrections(tmp)
    const after = await loadCorrections(tmp)
    expect(after.corrections.length).toBe(0)
  })

  it('returns empty when the file does not exist', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'pl-corr-fresh-'))
    const loaded = await loadCorrections(fresh)
    expect(loaded.corrections.length).toBe(0)
    expect(loaded.malformedLineCount).toBe(0)
    rmSync(fresh, { recursive: true, force: true })
  })

  it('treats a wholly malformed file as zero corrections without crashing', async () => {
    // Pre-create the meta dir + a junk file
    const dir = join(tmp, '.prompt-librarian')
    await fs.mkdir(dir, { recursive: true })
    writeFileSync(join(dir, 'corrections.jsonl'), 'totally bogus\nsecond\nthird\n')
    const loaded = await loadCorrections(tmp)
    expect(loaded.corrections.length).toBe(0)
    expect(loaded.malformedLineCount).toBe(3)
  })
})

describe('sanitizeMetadata', () => {
  it('coerces missing fields to empty strings/arrays', () => {
    const sanitized = sanitizeMetadata({})
    expect(sanitized.title).toBe('')
    expect(sanitized.tags).toEqual([])
  })
  it('strips non-string tags', () => {
    const sanitized = sanitizeMetadata({ tags: ['ok', 42, null, 'good'] })
    expect(sanitized.tags).toEqual(['ok', 'good'])
  })
})
