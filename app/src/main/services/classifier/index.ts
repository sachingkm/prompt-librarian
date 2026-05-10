// Router/facade for classification. The IPC layer talks only to this
// module - it doesn't know about deterministic vs Gemini implementations.
//
// Responsibilities:
//   - load fresh rules from disk on every classify call (no cache, no
//     watcher): a user editing rules.json sees the change at next click
//   - compute allowedFolders/allowedCategories from rules + library state
//     before delegating to the actual classifier
//   - dispatch to deterministic or Gemini based on settings/explicit
//     request
//   - wrap errors so the renderer always gets a ClassifyResponse

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

export interface AiStatusSnapshot {
  provider: ClassifierProvider
  geminiAvailable: boolean
  keySource: 'env' | 'stored' | 'none'
  model: string | null
  warnings: string[]
}

export async function getAiStatus(): Promise<AiStatusSnapshot> {
  const provider = await settings.getClassifierProvider()
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

  return { provider, geminiAvailable, keySource, model, warnings }
}

// Debug-gated key fingerprint logger. Never logs the full key. Enable
// with PROMPT_LIBRARIAN_DEBUG=1 when diagnosing "API key not valid" errors.
function debugLogKey(source: 'env' | 'stored', key: string | null): void {
  if (process.env.PROMPT_LIBRARIAN_DEBUG !== '1') return
  if (!key) {
    console.log(`[gemini-diag] resolveApiKey: source=${source} key=null`)
    return
  }
  const fp = `${key.slice(0, 4)}...${key.slice(-4)}`
  console.log(`[gemini-diag] resolveApiKey: source=${source} fp=${fp} len=${key.length}`)
}

async function resolveApiKey(): Promise<string | null> {
  const env = process.env[ENV_KEY]
  if (env && env.trim().length > 0) {
    const k = env.trim()
    debugLogKey('env', k)
    return k
  }
  const stored = await secrets.readSecret()
  debugLogKey('stored', stored)
  return stored
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

  // 2. Decide provider.
  const explicit =
    req.provider && req.provider !== 'auto' ? (req.provider as ClassifierProvider) : null
  const provider = explicit ?? (await settings.getClassifierProvider())

  // 3. Always run deterministic first - cheap, offline, and forms the
  // hint we send to AI providers when they're chosen.
  const detResult = classifyDeterministic({
    rawText: req.rawText,
    rules: loaded.rules,
    allowedFolders,
    allowedCategories
  })

  if (provider === 'deterministic') {
    return { ok: true, result: detResult }
  }

  // 4. Provider is Gemini.
  const input: ClassificationInput = {
    rawText: req.rawText,
    rules: loaded.rules,
    allowedFolders,
    allowedCategories,
    deterministicHint: req.deterministicHint ?? detResult
  }
  try {
    const result = await classifierByProvider('gemini').classify(input)
    return { ok: true, result }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in (err as object)) {
      const ce = err as ClassifierError
      return { ok: false, error: ce }
    }
    return {
      ok: false,
      error: { code: 'unknown', message: (err as Error).message ?? 'Unknown error.' }
    }
  }
}

// Convenience for the IPC handler when the Settings UI also wants
// "current rules + validation" without classifying.
export async function getClassificationContext(): Promise<{
  rules: ClassifierRulesContext
}> {
  const root = await settings.getRootPath()
  if (!root) {
    throw new Error('Library root is not set.')
  }
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

// Expose result type for downstream IPC binding.
import type { ClassifierRules, ClassifierRulesValidation } from '../../../shared/classifierRules'

interface ClassifierRulesContext {
  rules: ClassifierRules
  validation: ClassifierRulesValidation
  usingDefaults: boolean
  path: string
}
// Suppress unused warning for ClassificationResult import at top.
export type { ClassificationResult }
