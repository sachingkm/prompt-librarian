// Tests for the pure duplicate-detection helpers.

import { describe, expect, it } from 'vitest'
import {
  ExistingPromptBody,
  NEAR_DUPLICATE_THRESHOLD,
  findDuplicates,
  normalizeBody,
  similarity
} from './dedup'

describe('normalizeBody', () => {
  it('collapses whitespace and trims, preserving case', () => {
    expect(normalizeBody('  Hello   World\r\n\r\nFoo  ')).toBe('Hello World Foo')
  })
  it('returns empty string for non-strings', () => {
    expect(normalizeBody(undefined as unknown as string)).toBe('')
  })
})

describe('similarity', () => {
  it('is 1 for identical bodies after normalization', () => {
    expect(similarity('Clean this\ntranscript', 'Clean this   transcript')).toBe(1)
  })
  it('is 1 for two empty bodies', () => {
    expect(similarity('   ', '\n\n')).toBe(1)
  })
  it('is 0 when one side is empty and the other is not', () => {
    expect(similarity('', 'something here at all')).toBe(0)
  })
  it('is high for a near-duplicate with a small edit', () => {
    const a = 'Please clean up this meeting transcript and remove filler words'
    const b = 'Please clean up this meeting transcript and remove all filler words'
    expect(similarity(a, b)).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD)
  })
  it('is low for unrelated prompts', () => {
    const a = 'Summarize this quarterly earnings report into three bullets'
    const b = 'Write a haiku about the ocean at sunrise please'
    expect(similarity(a, b)).toBeLessThan(NEAR_DUPLICATE_THRESHOLD)
  })
})

describe('findDuplicates', () => {
  const existing: ExistingPromptBody[] = [
    {
      relPath: '02-Create/draft-email.md',
      folder: '02-Create',
      title: 'Draft email',
      body: 'Write a polite follow-up email to a client about an overdue invoice'
    },
    {
      relPath: '01-Transform/clean-transcript.md',
      folder: '01-Transform',
      title: 'Clean transcript',
      body: 'Please clean up this meeting transcript and remove filler words'
    }
  ]

  it('flags an exact re-paste as matchType exact', () => {
    const out = findDuplicates(
      'Please clean up this meeting transcript and remove filler words',
      existing
    )
    expect(out.length).toBe(1)
    expect(out[0].matchType).toBe('exact')
    expect(out[0].relPath).toBe('01-Transform/clean-transcript.md')
    expect(out[0].similarity).toBe(1)
  })

  it('flags a lightly edited body as matchType near', () => {
    const out = findDuplicates(
      'Please clean up this meeting transcript and remove all filler words now',
      existing
    )
    expect(out.length).toBe(1)
    expect(out[0].matchType).toBe('near')
    expect(out[0].similarity).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD)
    expect(out[0].similarity).toBeLessThan(1)
  })

  it('returns nothing for an unrelated prompt', () => {
    const out = findDuplicates('Generate three startup name ideas for a coffee app', existing)
    expect(out).toEqual([])
  })

  it('returns nothing for empty input', () => {
    expect(findDuplicates('   ', existing)).toEqual([])
  })

  it('sorts exact matches ahead of near matches', () => {
    const withDupes: ExistingPromptBody[] = [
      ...existing,
      {
        relPath: '01-Transform/clean-transcript-2.md',
        folder: '01-Transform',
        title: 'Clean transcript 2',
        body: 'Please clean up this meeting transcript and remove filler words today'
      }
    ]
    const out = findDuplicates(
      'Please clean up this meeting transcript and remove filler words',
      withDupes
    )
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(out[0].matchType).toBe('exact')
    expect(out[0].similarity).toBe(1)
  })
})
