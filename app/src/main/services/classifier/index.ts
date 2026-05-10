// Router/facade for classification. The IPC layer talks only to this
// module. Phase 4B added:
//   - AI-default provider resolution (Gemini auto-selected when key
//     available and user hasn't set a manual override).
//   - Gemini few-shot context: recent corrections (preview/category/folder
//     only) supplied to the Gemini system prompt.
//   - Fallback-to-deterministic with classifier:fallback marker when
//     Gemini fails so the renderer can show an inline note.

import type {
  ClassificationInput,
  ClassificationResult,
  Classifier,
  ClassifierError,
  ClassifierProvider
} from '../../../shared/classifier'
import {
  collectRuleFolders,
  listEnabledCategoryLabels
} from '../../../shared/classifierRules'
import type { ClassifyRequest, ClassifyResponse } from '../../../shared/ipc'
import * as settings from '../settings'
import * as library from '../library'
import { loadRules } from '../rules/rulesService'
import * as secrets from '../secrets'
import * as corrections from '../corrections'
import { classifyDeterministic, deterministicClassifier } from './deterministic/classifier'
import { DEFAULT_GEMINI_MODEL, makeGeminiClassifier } from './gemini/classifier'

const ENV_KEY = 'PROMPT_LIBRARIAN_GEMINI_API_KEY'
const ENV_MODEL = 'PROMPT_LIBRARIAN_GEMINI_MODEL'

async function resolveLibraryFolders(): Promise<string[]> {
  try {
    return await library.listFolders()
  } catch {
    return []
  }
}

async function geminiKeyAvailable(): Promise<boolean> {
  if (process.env[ENV_KEY] && process.env[ENV_KEY]!.trim().length > 0) return true
  return secrets.hasStoredSecret()
}

export interface AiStatusSnapshot {
  // The effective provider we will use right now (manual override OR
  // automatic-with-key OR deterministic).
  provider: ClassifierProvider
  // What the user explicitly set (if anything). Lets the renderer surface
  // "Auto: Gemini" vs "Auto: deterministic" vs "Forced: deterministic".
  manualOverride: ClassifierProvider | null
  geminiAvailable: boolean
  keySource: 'env' | 'stored' | 'none'
  model: string | null
  warnings: string[]
}

export async function getAiStatus(): Promise<AiStatusSnapshot> {
  const manualOverride = await settings.getManualClassifierProvider()
  const warnings: string[] = []

  let keySource: 'env' | 'stored' | 'none' = 'none'
  if (process.env[ENV_KEY] && process.env[ENV_KEY]!.trim().length > 0) {
    keySource = 'env'
  } else if (await secrets.hasStoredSecret()) {
    if (!secrets.isSecretStorageAvailable()) {
      warnings.push(
        'A stored Gemini key was found but OS keychain encryption is unavailable; it cannot be decrypted.'
      )
    } else {
      keySource = 'stored'
    }
  }

  if (keySource === 'none' && !secrets.isSecretStorageAvailable()) {
    warnings.push(
      'OS keychain encryption is unavailable on this machine; Gemini keys cannot be saved here. Set PROMPT_LIBRARIAN_GEMINI_API_KEY to use Gemini for this session.'
    )
  }

  const model = process.env[ENV_MODEL] || DEFAULT_GEMINI_MODEL
  const geminiAvailable = keySource !== 'none'

  // Auto-default: when no manual override is set, Gemini wins iff a key
  // is configured. Otherwise deterministic. Manual override always wins.
  let provider: ClassifierProvider
  if (manualOverride) {
    provider = manualOverride
  } else {
    provider = geminiAvailable ? 'gemini' : 'deterministic'
  }

  return { provider, manualOverride, geminiAvailable, keySource, model, warnings }
}

async function resolveApiKey(): Promise<string | null> {
  const env = process.env[ENV_KEY]
  if (env && env.trim().length > 0) return env.trim()
  return secrets.readSecret()
}

function resolveModel(): string {
  return process.env[ENV_MODEL] || DEFAULT_GEMINI_MODEL
}

const geminiClassifier: Classifier = makeGeminiClassifier({
  resolveApiKey,
  resolveModel
})

function classifierByProvider(p: ClassifierProvider): Classifier {
  return p === 'gemini' ? geminiClassifier : deterministicClassifier
}

export async function classify(req: ClassifyRequest): Promise<ClassifyResponse> {
  if (typeof req?.rawText !== 'string' || req.rawText.length === 0) {
    return {
      ok: false,
      error: { code: 'unknown', message: 'rawText must be a non-empty string.' }
    }
  }

  // 1. Resolve library root and rules.
  const root = await settings.getRootPath()
  if (!root) {
    return {
      ok: false,
      error: {
        code: 'unknown',
        message: 'Library root is not set. Open Settings and choose a library folder first.'
      }
    }
  }

  const onDiskFolders = await resolveLibraryFolders()
  const loaded = await loadRules(root, onDiskFolders)
  if (!loaded.validation.ok && !loaded.usingDefaults) {
    return {
      ok: false,
      error: {
        code: 'rules-invalid',
        message:
          'Classification rules are invalid. See Settings -> Classification rules to fix the file.'
      }
    }
  }

  const allowedFolders = Array.from(
    new Set([...collectRuleFolders(loaded.rules), ...onDiskFolders])
  )
  const allowedCategories = listEnabledCategoryLabels(loaded.rules)

  // 2. Decide provider. 'auto' / unspecified honours the AI-default rule.
  const explicit =
    req.provider && req.provider !== 'auto' ? (req.provider as ClassifierProvider) : null
  let provider: ClassifierProvider
  if (explicit) {
    provider = explicit
  } else {
    const status = await getAiStatus()
    provider = status.provider
  }

  // 3. Always run deterministic first.
  const detResult = classifyDeterministic({
    rawText: req.rawText,
    rules: loaded.rules,
    allowedFolders,
    allowedCategories
  })

  if (provider === 'deterministic') {
    return { ok: true, result: detResult }
  }

  // 4. Build Gemini input with optional few-shot context.
  let fewShot: ClassificationInput['fewShotExamples'] | undefined
  try {
    const useExamples = await settings.getUseCorrectionsAsExamples()
    if (useExamples) {
      const loaded = await corrections.loadCorrections(root)
      fewShot = buildFewShotExamples(loaded.corrections, detResult)
    }
  } catch {
    // Few-shot is best-effort. If anything blows up, classify without it.
  }

  const input: ClassificationInput = {
    rawText: req.rawText,
    rules: loaded.rules,
    allowedFolders,
    allowedCategories,
    deterministicHint: req.deterministicHint ?? detResult,
    fewShotExamples: fewShot
  }
  try {
    const result = await classifierByProvider('gemini').classify(input)
    return { ok: true, result }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in (err as object)) {
      const ce = err as ClassifierError
      // Phase 4B: when Gemini fails the user still gets a result and a
      // friendly inline note in the UI. We surface BOTH the deterministic
      // fallback AND the original error code/message via the `fallback`
      // field so the renderer can show "Gemini unavailable - <code>".
      return {
        ok: true,
        result: detResult,
        fallback: {
          fromProvider: 'gemini',
          to: 'deterministic',
          reason: ce.code,
          message: ce.message
        }
      }
    }
    return {
      ok: true,
      result: detResult,
      fallback: {
        fromProvider: 'gemini',
        to: 'deterministic',
        reason: 'unknown',
        message: (err as Error).message ?? 'Unknown error.'
      }
    }
  }
}

// ---- Few-shot builder ------------------------------------------------

import type { Correction } from '../../../shared/correction'

const FEWSHOT_MAX_EXAMPLES = 8
const FEWSHOT_PER_EXAMPLE_BUDGET = 110 // approx tokens per example
const FEWSHOT_TOTAL_TOKEN_BUDGET = 1000

interface FewShotExample {
  preview: string
  suggestedCategory: string
  suggestedFolder: string
  acceptedCategory: string
  acceptedFolder: string
  acceptedTags: string[]
  acceptedReuse: string
  acceptedScope: string
}

// Pick the most relevant recent corrections. Relevance heuristic:
// 1) corrections whose accepted category matches the deterministic
//    suggestion (strongest signal that the user prefers this routing),
// 2) corrections that share any token with the prompt's matched keywords,
// 3) most-recent fallback. Cap at FEWSHOT_MAX_EXAMPLES.
function buildFewShotExamples(
  all: Correction[],
  hint: ClassificationResult
): FewShotExample[] {
  if (all.length === 0) return []
  const matched = new Set((hint.reasoning.matchedKeywords ?? []).map((k) => k.toLowerCase()))
  const sameCategory = all.filter(
    (c) => c.accepted.category && c.accepted.category === hint.category
  )
  const overlap = all.filter((c) => {
    const previewWords = c.rawTextPreview.toLowerCase().split(/\W+/).filter(Boolean)
    return previewWords.some((w) => matched.has(w))
  })
  const seen = new Set<string>()
  const ordered: Correction[] = []
  for (const c of [...sameCategory.reverse(), ...overlap.reverse(), ...all.slice().reverse()]) {
    if (seen.has(c.timestamp + c.rawTextHash)) continue
    seen.add(c.timestamp + c.rawTextHash)
    ordered.push(c)
    if (ordered.length >= FEWSHOT_MAX_EXAMPLES) break
  }
  // Apply token budget: rough estimate at 4 chars/token.
  let budgetChars = FEWSHOT_TOTAL_TOKEN_BUDGET * 4
  const out: FewShotExample[] = []
  for (const c of ordered) {
    const ex: FewShotExample = {
      preview: c.rawTextPreview.slice(0, 240),
      suggestedCategory: c.suggested.category,
      suggestedFolder: c.suggested.recommendedFolder,
      acceptedCategory: c.accepted.category,
      acceptedFolder: c.accepted.recommendedFolder,
      acceptedTags: c.accepted.tags.slice(0, 6),
      acceptedReuse: c.accepted.reuse,
      acceptedScope: c.accepted.scope
    }
    const cost = JSON.stringify(ex).length
    if (cost > budgetChars) break
    budgetChars -= cost
    out.push(ex)
    if (out.length >= FEWSHOT_MAX_EXAMPLES) break
    void FEWSHOT_PER_EXAMPLE_BUDGET // exposed only for tuning visibility
  }
  return out
}

// Exposed for tests.
export const _internal = { buildFewShotExamples }

// Convenience for the IPC handler when the Settings UI also wants
// "current rules + validation" without classifying.
export async function getClassificationContext(): Promise<{
  rules: ClassifierRulesContext
}> {
  const root = await settings.getRootPath()
  if (!root) throw new Error('Library root is not set.')
  const onDisk = await resolveLibraryFolders()
  void root
  const loaded = await loadRules(root, onDisk)
  return {
    rules: {
      rules: loaded.rules,
      validation: loaded.validation,
      usingDefaults: loaded.usingDefaults,
      path: loaded.path
    }
  }
}

import type { ClassifierRules, ClassifierRulesValidation } from '../../../shared/classifierRules'

interface ClassifierRulesContext {
  rules: ClassifierRules
  validation: ClassifierRulesValidation
  usingDefaults: boolean
  path: string
}
export type { ClassificationResult }
