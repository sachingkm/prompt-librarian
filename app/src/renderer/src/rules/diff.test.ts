// Tests for the "modified from defaults" diff helper.

import { describe, expect, it } from 'vitest'
import { DEFAULT_CLASSIFIER_RULES } from '../../../shared/classifierRules'
import { diffAgainstDefaults } from './diff'

describe('diffAgainstDefaults', () => {
  it('reports nothing modified when rules equal defaults', () => {
    const d = diffAgainstDefaults(DEFAULT_CLASSIFIER_RULES)
    expect(d.modifiedCategories.size).toBe(0)
    expect(d.modifiedSubcategories.size).toBe(0)
    expect(d.modifiedProjects.size).toBe(0)
    expect(d.categoriesShapeChanged).toBe(false)
    expect(d.projectsShapeChanged).toBe(false)
    expect(d.fallbackChanged).toBe(false)
    expect(d.scoringChanged).toBe(false)
    expect(d.reuseDefaultsChanged).toBe(false)
  })

  it('flags an edited category', () => {
    const next = {
      ...DEFAULT_CLASSIFIER_RULES,
      categories: DEFAULT_CLASSIFIER_RULES.categories.map((c) =>
        c.id === 'transform' ? { ...c, label: 'Renamed' } : c
      )
    }
    const d = diffAgainstDefaults(next)
    expect(d.modifiedCategories.has('transform')).toBe(true)
    expect(d.modifiedCategories.has('create')).toBe(false)
  })

  it('flags an edited subcategory', () => {
    const next = {
      ...DEFAULT_CLASSIFIER_RULES,
      categories: DEFAULT_CLASSIFIER_RULES.categories.map((c) =>
        c.id === 'transform'
          ? {
              ...c,
              subcategories: (c.subcategories ?? []).map((s) =>
                s.id === 'transcript-cleanup' ? { ...s, label: 'Renamed' } : s
              )
            }
          : c
      )
    }
    const d = diffAgainstDefaults(next)
    expect(d.modifiedSubcategories.has('transcript-cleanup')).toBe(true)
  })

  it('flags shape changes when a category is added', () => {
    const next = {
      ...DEFAULT_CLASSIFIER_RULES,
      categories: [
        ...DEFAULT_CLASSIFIER_RULES.categories,
        {
          id: 'new-thing',
          label: 'New thing',
          folder: '03-New',
          enabled: true,
          priority: 0,
          keywords: []
        }
      ]
    }
    const d = diffAgainstDefaults(next)
    expect(d.categoriesShapeChanged).toBe(true)
    expect(d.modifiedCategories.has('new-thing')).toBe(true)
  })

  it('flags fallback/scoring/reuse changes', () => {
    const next = {
      ...DEFAULT_CLASSIFIER_RULES,
      fallback: { folder: '00-Index', label: 'Different label' },
      scoring: { highTier: 0.8, mediumTier: 0.5 },
      reuseDefaults: {
        highPhrases: ['extra'],
        lowPhrases: DEFAULT_CLASSIFIER_RULES.reuseDefaults.lowPhrases
      }
    }
    const d = diffAgainstDefaults(next)
    expect(d.fallbackChanged).toBe(true)
    expect(d.scoringChanged).toBe(true)
    expect(d.reuseDefaultsChanged).toBe(true)
  })
})
