// Renderer-side helpers for "modified from defaults" detection. We compare
// a candidate ClassifierRules tree against DEFAULT_CLASSIFIER_RULES and
// expose simple per-id booleans for the UI. Stable & pure.

import type {
  ClassifierRuleCategory,
  ClassifierRuleProject,
  ClassifierRuleSubcategory,
  ClassifierRules
} from '../../../shared/classifierRules'
import { DEFAULT_CLASSIFIER_RULES } from '../../../shared/classifierRules'

function canonicalize(value: unknown): string {
  // Stable key ordering so { a:1, b:2 } and { b:2, a:1 } compare equal.
  return JSON.stringify(value, Object.keys(value as object).sort())
}

function deepEqualSortedKeys(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualSortedKeys(a[i], b[i])) return false
    }
    return true
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort()
    const bk = Object.keys(b as object).sort()
    if (ak.length !== bk.length) return false
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) return false
      if (!deepEqualSortedKeys((a as Record<string, unknown>)[ak[i]], (b as Record<string, unknown>)[bk[i]])) {
        return false
      }
    }
    return true
  }
  return false
}

export interface RulesDiff {
  // Per-id booleans: true when the user's rule differs from the default by id.
  modifiedCategories: Set<string>
  modifiedSubcategories: Set<string> // sub.id
  modifiedProjects: Set<string>
  // True when categories list itself changed shape (added/removed items).
  categoriesShapeChanged: boolean
  projectsShapeChanged: boolean
  fallbackChanged: boolean
  scoringChanged: boolean
  reuseDefaultsChanged: boolean
}

export function diffAgainstDefaults(rules: ClassifierRules): RulesDiff {
  const defaults = DEFAULT_CLASSIFIER_RULES
  const modifiedCategories = new Set<string>()
  const modifiedSubcategories = new Set<string>()
  const modifiedProjects = new Set<string>()

  const defaultCatById = new Map<string, ClassifierRuleCategory>()
  for (const c of defaults.categories) defaultCatById.set(c.id, c)
  for (const c of rules.categories) {
    const d = defaultCatById.get(c.id)
    if (!d || !categoriesEqual(c, d)) modifiedCategories.add(c.id)
    const dSubs = new Map<string, ClassifierRuleSubcategory>()
    for (const s of d?.subcategories ?? []) dSubs.set(s.id, s)
    for (const s of c.subcategories ?? []) {
      const ds = dSubs.get(s.id)
      if (!ds || !deepEqualSortedKeys(canonicalize(s), canonicalize(ds))) {
        modifiedSubcategories.add(s.id)
      }
    }
  }

  const defaultProjById = new Map<string, ClassifierRuleProject>()
  for (const p of defaults.projects) defaultProjById.set(p.id, p)
  for (const p of rules.projects) {
    const d = defaultProjById.get(p.id)
    if (!d || canonicalize(p) !== canonicalize(d)) modifiedProjects.add(p.id)
  }

  const categoriesShapeChanged =
    rules.categories.length !== defaults.categories.length ||
    rules.categories.some((c) => !defaultCatById.has(c.id))
  const projectsShapeChanged =
    rules.projects.length !== defaults.projects.length ||
    rules.projects.some((p) => !defaultProjById.has(p.id))

  const fallbackChanged = canonicalize(rules.fallback) !== canonicalize(defaults.fallback)
  const scoringChanged = canonicalize(rules.scoring) !== canonicalize(defaults.scoring)
  const reuseDefaultsChanged =
    canonicalize(rules.reuseDefaults) !== canonicalize(defaults.reuseDefaults)

  return {
    modifiedCategories,
    modifiedSubcategories,
    modifiedProjects,
    categoriesShapeChanged,
    projectsShapeChanged,
    fallbackChanged,
    scoringChanged,
    reuseDefaultsChanged
  }
}

function categoriesEqual(a: ClassifierRuleCategory, b: ClassifierRuleCategory): boolean {
  // Compare without subcategories - those have their own diff.
  const ca = { ...a, subcategories: undefined }
  const cb = { ...b, subcategories: undefined }
  return canonicalize(ca) === canonicalize(cb)
}
