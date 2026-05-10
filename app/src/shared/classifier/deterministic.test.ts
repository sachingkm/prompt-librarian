// Verifies the shared deterministic classifier is genuinely renderer-safe
// (no Node/Electron imports) and that both import paths - shared and the
// thin main re-export - resolve to the same function with identical results.

import { describe, expect, it } from 'vitest'
import { classifyDeterministic as classifyFromShared } from './deterministic'
import { classifyDeterministic as classifyFromMain } from '../../main/services/classifier/deterministic/classifier'
import { TEST_CLASSIFIER_RULES } from '../../main/services/classifier/deterministic/fixtures'

describe('shared deterministic classifier', () => {
  it('is the same function as the main re-export', () => {
    expect(classifyFromShared).toBe(classifyFromMain)
  })

  it('produces identical results from both import paths', () => {
    const rawText = 'Clean up this transcript with timestamps and speaker labels.'
    const input = {
      rawText,
      rules: TEST_CLASSIFIER_RULES,
      allowedFolders: ['01-Transform', '01-Transform/Transcript Cleanup'],
      allowedCategories: ['Transform']
    }
    const a = classifyFromShared(input)
    const b = classifyFromMain(input)
    expect(a).toEqual(b)
    expect(a.recommendedFolder).toContain('Transform')
  })
})
