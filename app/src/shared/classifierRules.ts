// User-editable classification rules. The on-disk file lives at
// <library-root>/.prompt-librarian/rules.json. Schema is intentionally
// data-driven so the Phase 4B visual editor can read/write the same file
// without changing this format.

export const CLASSIFIER_RULES_VERSION = 1

export interface ClassifierRuleKeyword {
  term: string
  weight: number
}

export interface ClassifierRuleSubcategory {
  id: string
  label: string
  folder: string
  enabled?: boolean
  keywords?: ClassifierRuleKeyword[]
  negativeKeywords?: string[]
  tags?: string[]
}

export interface ClassifierRuleCategory {
  id: string
  label: string
  folder: string
  enabled?: boolean
  priority?: number
  keywords?: ClassifierRuleKeyword[]
  negativeKeywords?: string[]
  tags?: string[]
  subcategories?: ClassifierRuleSubcategory[]
}

export interface ClassifierRuleProject {
  id: string
  label: string
  folder: string
  enabled?: boolean
  priority?: number
  triggers: string[]
  negativeKeywords?: string[]
  tags?: string[]
}

export interface ClassifierRuleScoring {
  highTier: number
  mediumTier: number
}

export interface ClassifierRuleReuseDefaults {
  highPhrases: string[]
  lowPhrases: string[]
}

export interface ClassifierRuleFallback {
  folder: string
  label: string
}

export interface ClassifierRules {
  version: number
  categories: ClassifierRuleCategory[]
  projects: ClassifierRuleProject[]
  fallback: ClassifierRuleFallback
  scoring: ClassifierRuleScoring
  reuseDefaults: ClassifierRuleReuseDefaults
}

// Validation result. Errors are blocking (file is unusable). Warnings are
// non-fatal (e.g. a rule references a folder not present in the library).
// Each issue carries a JSON-Pointer-style `path` (e.g.
// `/categories/2/keywords/0/weight`) so the future Phase 4B editor can map
// errors directly to UI fields.
export interface ClassifierRulesIssue {
  path: string
  message: string
  // For JSON syntax errors only.
  line?: number
  column?: number
}

export interface ClassifierRulesValidation {
  ok: boolean
  errors: ClassifierRulesIssue[]
  warnings: ClassifierRulesIssue[]
}

// ---------------------------------------------------------------------
// Defaults shipped with the app. Phase 4B will diff user rules against
// this snapshot to surface "modified from defaults" indicators.
// ---------------------------------------------------------------------

export const DEFAULT_NEGATIVE_KEYWORD_PENALTY = 3

export const DEFAULT_CLASSIFIER_RULES: ClassifierRules = {
  version: CLASSIFIER_RULES_VERSION,
  categories: [
    {
      id: 'core-transforms',
      label: 'Core Transforms',
      folder: '01-Core Transforms',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'transcript', weight: 3 },
        { term: 'transcriber', weight: 2 },
        { term: 'speaker', weight: 2 },
        { term: 'timestamp', weight: 2 },
        { term: 'inaudible', weight: 2 },
        { term: 'dialogue', weight: 2 },
        { term: 'rewrite', weight: 1 },
        { term: 'summarize', weight: 1 },
        { term: 'format', weight: 1 }
      ],
      tags: ['transform'],
      subcategories: [
        {
          id: 'transcript-cleanup',
          label: 'Transcript Cleanup',
          folder: '01-Core Transforms',
          enabled: true,
          keywords: [
            { term: 'inaudible', weight: 2 },
            { term: 'cleanup', weight: 2 },
            { term: 'verbatim', weight: 1 }
          ],
          tags: ['cleanup']
        }
      ]
    },
    {
      id: 'interview',
      label: 'Interview',
      folder: '02-Interview',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'interview', weight: 3 },
        { term: 'recruiter', weight: 2 },
        { term: 'hiring manager', weight: 2 },
        { term: 'star', weight: 2 },
        { term: 'mock interview', weight: 3 },
        { term: 'candidate', weight: 1 },
        { term: 'interviewer', weight: 2 }
      ],
      tags: ['interview']
    },
    {
      id: 'job-search',
      label: 'Job Search',
      folder: '03-Job Search',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'resume', weight: 3 },
        { term: 'jd', weight: 2 },
        { term: 'job description', weight: 3 },
        { term: 'role', weight: 1 },
        { term: 'cover letter', weight: 3 },
        { term: 'linkedin', weight: 2 },
        { term: 'job application', weight: 3 }
      ],
      tags: ['job-search']
    },
    {
      id: 'product-specs',
      label: 'Product Specs',
      folder: '04-Product Specs',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'prd', weight: 3 },
        { term: 'specification', weight: 3 },
        { term: 'architecture', weight: 2 },
        { term: 'requirements', weight: 2 },
        { term: 'feature', weight: 1 },
        { term: 'acceptance criteria', weight: 3 },
        { term: 'user story', weight: 3 }
      ],
      tags: ['product-spec']
    },
    {
      id: 'research',
      label: 'Research',
      folder: '05-Research',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'research', weight: 3 },
        { term: 'compare', weight: 2 },
        { term: 'synthesis', weight: 2 },
        { term: 'findings', weight: 2 },
        { term: 'evidence', weight: 2 },
        { term: 'analyze', weight: 1 }
      ],
      tags: ['research']
    },
    {
      id: 'examples',
      label: 'Examples',
      folder: '90-Examples',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'example prompt', weight: 3 },
        { term: 'sample prompt', weight: 3 },
        { term: 'template', weight: 1 }
      ],
      tags: ['example']
    }
  ],
  projects: [
    {
      id: 'career-buddy',
      label: 'Career Buddy',
      folder: '06-Project Prompts/Career Buddy',
      enabled: true,
      priority: 5,
      triggers: ['Career Buddy'],
      tags: ['career-buddy']
    },
    {
      id: 'openclaw',
      label: 'OpenClaw',
      folder: '06-Project Prompts/OpenClaw',
      enabled: true,
      priority: 5,
      triggers: ['OpenClaw'],
      tags: ['openclaw']
    }
  ],
  fallback: {
    folder: '00-Index',
    label: 'Uncategorized'
  },
  scoring: {
    highTier: 0.7,
    mediumTier: 0.4
  },
  reuseDefaults: {
    highPhrases: ['template', 'always', 'every time', 'reusable'],
    lowPhrases: ['this specific', 'right now', 'one-off', 'just this once']
  }
}

// ---------------------------------------------------------------------
// Validators. Pure functions, exported so both the main process and the
// Phase 4B editor can reuse the same logic. Validators NEVER mutate
// input.
// ---------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pushError(out: ClassifierRulesIssue[], path: string, message: string): void {
  out.push({ path, message })
}

export function validateClassifierRules(
  raw: unknown,
  knownFolders: string[] = []
): ClassifierRulesValidation {
  const errors: ClassifierRulesIssue[] = []
  const warnings: ClassifierRulesIssue[] = []

  if (!isPlainObject(raw)) {
    pushError(errors, '', 'Top-level value must be a JSON object.')
    return { ok: false, errors, warnings }
  }

  const r = raw as Partial<ClassifierRules>

  if (typeof r.version !== 'number') {
    pushError(errors, '/version', 'version must be a number.')
  } else if (r.version !== CLASSIFIER_RULES_VERSION) {
    pushError(
      errors,
      '/version',
      `version must be ${CLASSIFIER_RULES_VERSION}, got ${r.version}.`
    )
  }

  if (!Array.isArray(r.categories)) {
    pushError(errors, '/categories', 'categories must be an array.')
  } else {
    r.categories.forEach((cat, i) =>
      validateCategory(cat, `/categories/${i}`, errors, warnings, knownFolders)
    )
  }

  if (!Array.isArray(r.projects)) {
    pushError(errors, '/projects', 'projects must be an array.')
  } else {
    r.projects.forEach((p, i) =>
      validateProject(p, `/projects/${i}`, errors, warnings, knownFolders)
    )
  }

  if (!isPlainObject(r.fallback)) {
    pushError(errors, '/fallback', 'fallback must be an object.')
  } else {
    if (typeof (r.fallback as ClassifierRuleFallback).folder !== 'string') {
      pushError(errors, '/fallback/folder', 'fallback.folder must be a string.')
    }
    if (typeof (r.fallback as ClassifierRuleFallback).label !== 'string') {
      pushError(errors, '/fallback/label', 'fallback.label must be a string.')
    }
  }

  if (!isPlainObject(r.scoring)) {
    pushError(errors, '/scoring', 'scoring must be an object with highTier and mediumTier.')
  } else {
    const s = r.scoring as ClassifierRuleScoring
    if (typeof s.highTier !== 'number' || s.highTier < 0 || s.highTier > 1) {
      pushError(errors, '/scoring/highTier', 'scoring.highTier must be a number 0..1.')
    }
    if (typeof s.mediumTier !== 'number' || s.mediumTier < 0 || s.mediumTier > 1) {
      pushError(errors, '/scoring/mediumTier', 'scoring.mediumTier must be a number 0..1.')
    }
    if (
      typeof s.highTier === 'number' &&
      typeof s.mediumTier === 'number' &&
      s.highTier < s.mediumTier
    ) {
      pushError(errors, '/scoring', 'scoring.highTier must be >= scoring.mediumTier.')
    }
  }

  if (!isPlainObject(r.reuseDefaults)) {
    pushError(errors, '/reuseDefaults', 'reuseDefaults must be an object.')
  } else {
    const rd = r.reuseDefaults as ClassifierRuleReuseDefaults
    if (!Array.isArray(rd.highPhrases)) {
      pushError(errors, '/reuseDefaults/highPhrases', 'highPhrases must be an array of strings.')
    }
    if (!Array.isArray(rd.lowPhrases)) {
      pushError(errors, '/reuseDefaults/lowPhrases', 'lowPhrases must be an array of strings.')
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

function validateKeyword(
  k: unknown,
  path: string,
  errors: ClassifierRulesIssue[]
): void {
  if (!isPlainObject(k)) {
    pushError(errors, path, 'keyword must be { term: string, weight: number }.')
    return
  }
  const kk = k as Partial<ClassifierRuleKeyword>
  if (typeof kk.term !== 'string' || kk.term.length === 0) {
    pushError(errors, `${path}/term`, 'keyword.term must be a non-empty string.')
  }
  if (typeof kk.weight !== 'number' || !isFinite(kk.weight)) {
    pushError(errors, `${path}/weight`, 'keyword.weight must be a finite number.')
  }
}

function validateStringArray(
  v: unknown,
  path: string,
  errors: ClassifierRulesIssue[]
): void {
  if (v == null) return
  if (!Array.isArray(v)) {
    pushError(errors, path, 'must be an array of strings.')
    return
  }
  v.forEach((item, i) => {
    if (typeof item !== 'string') {
      pushError(errors, `${path}/${i}`, 'must be a string.')
    }
  })
}

function validateCategory(
  cat: unknown,
  path: string,
  errors: ClassifierRulesIssue[],
  warnings: ClassifierRulesIssue[],
  knownFolders: string[]
): void {
  if (!isPlainObject(cat)) {
    pushError(errors, path, 'category must be an object.')
    return
  }
  const c = cat as Partial<ClassifierRuleCategory>
  if (typeof c.id !== 'string' || c.id.length === 0) {
    pushError(errors, `${path}/id`, 'category.id must be a non-empty string.')
  }
  if (typeof c.label !== 'string' || c.label.length === 0) {
    pushError(errors, `${path}/label`, 'category.label must be a non-empty string.')
  }
  if (typeof c.folder !== 'string' || c.folder.length === 0) {
    pushError(errors, `${path}/folder`, 'category.folder must be a non-empty string.')
  } else if (knownFolders.length > 0 && !knownFolders.includes(c.folder)) {
    warnings.push({
      path: `${path}/folder`,
      message: `category.folder "${c.folder}" is not present in the current library; it will be created on save.`
    })
  }
  if (c.enabled != null && typeof c.enabled !== 'boolean') {
    pushError(errors, `${path}/enabled`, 'category.enabled must be a boolean.')
  }
  if (c.priority != null && typeof c.priority !== 'number') {
    pushError(errors, `${path}/priority`, 'category.priority must be a number.')
  }
  if (Array.isArray(c.keywords)) {
    c.keywords.forEach((k, i) => validateKeyword(k, `${path}/keywords/${i}`, errors))
  } else if (c.keywords != null) {
    pushError(errors, `${path}/keywords`, 'category.keywords must be an array.')
  }
  validateStringArray(c.negativeKeywords, `${path}/negativeKeywords`, errors)
  validateStringArray(c.tags, `${path}/tags`, errors)
  if (Array.isArray(c.subcategories)) {
    c.subcategories.forEach((s, i) =>
      validateSubcategory(s, `${path}/subcategories/${i}`, errors, warnings, knownFolders)
    )
  } else if (c.subcategories != null) {
    pushError(errors, `${path}/subcategories`, 'category.subcategories must be an array.')
  }
}

function validateSubcategory(
  sub: unknown,
  path: string,
  errors: ClassifierRulesIssue[],
  warnings: ClassifierRulesIssue[],
  knownFolders: string[]
): void {
  if (!isPlainObject(sub)) {
    pushError(errors, path, 'subcategory must be an object.')
    return
  }
  const s = sub as Partial<ClassifierRuleSubcategory>
  if (typeof s.id !== 'string' || s.id.length === 0) {
    pushError(errors, `${path}/id`, 'subcategory.id must be a non-empty string.')
  }
  if (typeof s.label !== 'string' || s.label.length === 0) {
    pushError(errors, `${path}/label`, 'subcategory.label must be a non-empty string.')
  }
  if (typeof s.folder !== 'string' || s.folder.length === 0) {
    pushError(errors, `${path}/folder`, 'subcategory.folder must be a non-empty string.')
  } else if (knownFolders.length > 0 && !knownFolders.includes(s.folder)) {
    warnings.push({
      path: `${path}/folder`,
      message: `subcategory.folder "${s.folder}" is not present in the current library; it will be created on save.`
    })
  }
  if (s.enabled != null && typeof s.enabled !== 'boolean') {
    pushError(errors, `${path}/enabled`, 'subcategory.enabled must be a boolean.')
  }
  if (Array.isArray(s.keywords)) {
    s.keywords.forEach((k, i) => validateKeyword(k, `${path}/keywords/${i}`, errors))
  } else if (s.keywords != null) {
    pushError(errors, `${path}/keywords`, 'subcategory.keywords must be an array.')
  }
  validateStringArray(s.negativeKeywords, `${path}/negativeKeywords`, errors)
  validateStringArray(s.tags, `${path}/tags`, errors)
}

function validateProject(
  proj: unknown,
  path: string,
  errors: ClassifierRulesIssue[],
  warnings: ClassifierRulesIssue[],
  knownFolders: string[]
): void {
  if (!isPlainObject(proj)) {
    pushError(errors, path, 'project must be an object.')
    return
  }
  const p = proj as Partial<ClassifierRuleProject>
  if (typeof p.id !== 'string' || p.id.length === 0) {
    pushError(errors, `${path}/id`, 'project.id must be a non-empty string.')
  }
  if (typeof p.label !== 'string' || p.label.length === 0) {
    pushError(errors, `${path}/label`, 'project.label must be a non-empty string.')
  }
  if (typeof p.folder !== 'string' || p.folder.length === 0) {
    pushError(errors, `${path}/folder`, 'project.folder must be a non-empty string.')
  } else if (knownFolders.length > 0 && !knownFolders.includes(p.folder)) {
    warnings.push({
      path: `${path}/folder`,
      message: `project.folder "${p.folder}" is not present in the current library; it will be created on save.`
    })
  }
  if (p.enabled != null && typeof p.enabled !== 'boolean') {
    pushError(errors, `${path}/enabled`, 'project.enabled must be a boolean.')
  }
  if (p.priority != null && typeof p.priority !== 'number') {
    pushError(errors, `${path}/priority`, 'project.priority must be a number.')
  }
  if (!Array.isArray(p.triggers) || p.triggers.length === 0) {
    pushError(errors, `${path}/triggers`, 'project.triggers must be a non-empty array of strings.')
  } else {
    validateStringArray(p.triggers, `${path}/triggers`, errors)
  }
  validateStringArray(p.negativeKeywords, `${path}/negativeKeywords`, errors)
  validateStringArray(p.tags, `${path}/tags`, errors)
}

// Helper: collect every folder referenced anywhere in the rule tree.
// Used by main to ensure those folders exist (or are surfaced as
// "will be created on save") before classification.
export function collectRuleFolders(rules: ClassifierRules): string[] {
  const set = new Set<string>()
  set.add(rules.fallback.folder)
  for (const cat of rules.categories) {
    set.add(cat.folder)
    for (const sub of cat.subcategories ?? []) set.add(sub.folder)
  }
  for (const proj of rules.projects) set.add(proj.folder)
  return [...set]
}

// Helper: list every enabled category label, ordered by priority desc.
// This is what we send to Gemini as `allowedCategories` and what Phase 4B
// surfaces as the "active categories" list.
export function listEnabledCategoryLabels(rules: ClassifierRules): string[] {
  return rules.categories
    .filter((c) => c.enabled !== false)
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map((c) => c.label)
}
