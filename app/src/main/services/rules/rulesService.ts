// Owner of <library-root>/.prompt-librarian/rules.json. The renderer
// never reaches the file directly - all reads/writes flow through here.
// See ./README.md for the Phase 4B seam.

import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  CLASSIFIER_RULES_VERSION,
  ClassifierRules,
  ClassifierRulesIssue,
  ClassifierRulesValidation,
  DEFAULT_CLASSIFIER_RULES,
  collectRuleFolders,
  validateClassifierRules
} from '../../../shared/classifierRules'

const META_DIR = '.prompt-librarian'
const RULES_FILENAME = 'rules.json'

export interface LoadedRules {
  rules: ClassifierRules
  validation: ClassifierRulesValidation
  usingDefaults: boolean
  path: string
}

export function rulesPath(libraryRoot: string): string {
  return join(libraryRoot, META_DIR, RULES_FILENAME)
}

async function ensureMetaDir(libraryRoot: string): Promise<void> {
  await fs.mkdir(join(libraryRoot, META_DIR), { recursive: true })
}

async function writeRulesFile(libraryRoot: string, rules: ClassifierRules): Promise<void> {
  await ensureMetaDir(libraryRoot)
  const file = rulesPath(libraryRoot)
  // Atomic write: temp file + rename.
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(rules, null, 2) + '\n', 'utf8')
  await fs.rename(tmp, file)
}

function tryParseJson(
  raw: string
): { ok: true; value: unknown } | { ok: false; issue: ClassifierRulesIssue } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (err) {
    const e = err as Error
    // Best-effort line/column extraction. Modern V8 attaches a `position`
    // for SyntaxError; older runtimes don't, so the regex is a fallback.
    const issue: ClassifierRulesIssue = {
      path: '',
      message: `rules.json is not valid JSON: ${e.message}`
    }
    const m = /position (\d+)/.exec(e.message)
    if (m) {
      const pos = parseInt(m[1], 10)
      const before = raw.slice(0, pos)
      const line = before.split(/\r?\n/).length
      const lastNl = before.lastIndexOf('\n')
      issue.line = line
      issue.column = pos - (lastNl < 0 ? -1 : lastNl)
    }
    return { ok: false, issue }
  }
}

// Optional knownFolders argument lets validators warn when a rule
// references a folder that doesn't exist on disk yet.
export async function loadRules(
  libraryRoot: string,
  knownFolders: string[] = []
): Promise<LoadedRules> {
  const path = rulesPath(libraryRoot)
  let raw: string
  try {
    raw = await fs.readFile(path, 'utf8')
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      // First-run seed.
      await writeRulesFile(libraryRoot, DEFAULT_CLASSIFIER_RULES)
      return {
        rules: DEFAULT_CLASSIFIER_RULES,
        validation: { ok: true, errors: [], warnings: [] },
        usingDefaults: false,
        path
      }
    }
    return {
      rules: DEFAULT_CLASSIFIER_RULES,
      validation: {
        ok: false,
        errors: [{ path: '', message: `Could not read rules.json: ${e.message}` }],
        warnings: []
      },
      usingDefaults: true,
      path
    }
  }

  const parsed = tryParseJson(raw)
  if (!parsed.ok) {
    return {
      rules: DEFAULT_CLASSIFIER_RULES,
      validation: { ok: false, errors: [parsed.issue], warnings: [] },
      usingDefaults: true,
      path
    }
  }

  const validation = validateClassifierRules(parsed.value, knownFolders)
  if (!validation.ok) {
    return {
      rules: DEFAULT_CLASSIFIER_RULES,
      validation,
      usingDefaults: true,
      path
    }
  }
  // Cast is safe: validation passed.
  return {
    rules: parsed.value as ClassifierRules,
    validation,
    usingDefaults: false,
    path
  }
}

export async function resetRules(libraryRoot: string): Promise<{ ok: boolean; path: string; error?: string }> {
  const path = rulesPath(libraryRoot)
  try {
    await writeRulesFile(libraryRoot, DEFAULT_CLASSIFIER_RULES)
    return { ok: true, path }
  } catch (err) {
    return { ok: false, path, error: (err as Error).message }
  }
}

// Convenience: collect every folder referenced anywhere in the rules.
// Used both for the Gemini prompt and for the validator's "known folders"
// context.
export function rulesReferencedFolders(rules: ClassifierRules): string[] {
  return collectRuleFolders(rules)
}

// Sanity check: caller is responsible for resolving a real library root
// before calling anything here. We export this so the IPC layer can fail
// fast with a clear message.
export function assertVersionMatches(rules: ClassifierRules): void {
  if (rules.version !== CLASSIFIER_RULES_VERSION) {
    throw new Error(
      `rules.json version mismatch: file=${rules.version} expected=${CLASSIFIER_RULES_VERSION}`
    )
  }
}

// Used by tests that don't want to round-trip via disk.
export function rulesDir(libraryRoot: string): string {
  return dirname(rulesPath(libraryRoot))
}
