// Gemini classifier. Lives in main, never in renderer. The API key never
// leaves main; the renderer can only call classify() through IPC.
//
// Defaults verified against https://ai.google.dev/gemini-api/docs/pricing
// (gemini-2.5-flash-lite: free tier eligible, paid $0.10/$0.40 per 1M
// input/output tokens). Free-tier inputs may be used by Google to improve
// their products - that disclosure is surfaced in Settings and the
// in-app confirm dialog.
//
// Rate limits per official docs at the time of writing point to AI
// Studio's per-account dashboard rather than a fixed published table.
// We do not promise unlimited free usage in the UI.

import type {
  ClassificationInput,
  ClassificationResult,
  Classifier,
  ClassifierError,
  ConfidenceTier,
  ReuseLevel,
  Scope
} from '../../../../shared/classifier'
import { scoreTier } from '../../../../shared/classifier'
import { windowsSafeSlug } from '../deterministic/classifier'
import { buildGeminiPrompt } from './prompt'

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'
const ENDPOINT_TEMPLATE =
  'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_OUTPUT_TOKENS = 1024

export interface GeminiResolvedConfig {
  model: string
  // Where the key was sourced from. Renderer only ever sees the SOURCE,
  // never the value.
  keySource: 'env' | 'stored' | 'none'
  warnings: string[]
}

interface GeminiCallResult {
  ok: true
  result: ClassificationResult
}

interface GeminiCallFailure {
  ok: false
  error: ClassifierError
}

export type GeminiClassifyResult = GeminiCallResult | GeminiCallFailure

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
}

function err(code: ClassifierError['code'], message: string): GeminiCallFailure {
  return { ok: false, error: { code, message } }
}

function resolveEndpoint(model: string): string {
  return ENDPOINT_TEMPLATE.replace('{MODEL}', encodeURIComponent(model))
}

function safeParseJson(raw: string): unknown {
  // Strip a stray markdown fence if the model sneaked one in. We tell it
  // not to, but defensive parsing is cheap.
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  return JSON.parse(s)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clamp01(n: number): number {
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function asReuse(v: unknown): ReuseLevel | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (t === 'low' || t === 'medium' || t === 'high') return t
  return null
}

function asScope(v: unknown): Scope | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (t === 'reusable' || t === 'one-off') return t
  return null
}

function asTier(v: unknown): ConfidenceTier | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (t === 'low' || t === 'medium' || t === 'high') return t
  return null
}

// Validate and normalize the model's JSON output. Coerce minor issues
// (trim strings, lowercase tags, clamp confidence) but reject invented
// folders/categories with parse error.
function normalizeGeminiResult(
  raw: unknown,
  input: ClassificationInput
): ClassificationResult | null {
  if (!isPlainObject(raw)) return null

  const allowedFolders = new Set(input.allowedFolders)
  const allowedCategories = new Set(input.allowedCategories)

  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!title) return null

  const category = typeof raw.category === 'string' ? raw.category.trim() : ''
  if (!category || !allowedCategories.has(category)) return null

  let recommendedFolder =
    typeof raw.recommendedFolder === 'string' ? raw.recommendedFolder.trim() : ''
  if (!recommendedFolder || !allowedFolders.has(recommendedFolder)) return null
  if (recommendedFolder.startsWith('99-')) return null // never archive new prompts

  const subcategoryRaw = typeof raw.subcategory === 'string' ? raw.subcategory.trim() : ''
  const subcategory = subcategoryRaw.length > 0 ? subcategoryRaw : undefined

  const reuse = asReuse(raw.reuse)
  if (!reuse) return null
  const scope = asScope(raw.scope)
  if (!scope) return null

  let tagsArr: string[] = []
  if (Array.isArray(raw.tags)) {
    tagsArr = raw.tags
      .filter((t) => typeof t === 'string')
      .map((t) => (t as string).trim().toLowerCase())
      .filter((t) => t.length > 0)
      .slice(0, 8)
  }

  const filenameRaw = typeof raw.filename === 'string' ? raw.filename.trim() : ''
  const filename = filenameRaw.length > 0
    ? windowsSafeSlug(filenameRaw.replace(/\.md$/i, '')) + '.md'
    : windowsSafeSlug(title) + '.md'

  let scoreNum = 0
  let tier: ConfidenceTier = 'low'
  if (isPlainObject(raw.confidence)) {
    const conf = raw.confidence
    if (typeof conf.score === 'number') scoreNum = clamp01(conf.score)
    const t = asTier(conf.tier)
    if (t) tier = t
    else tier = scoreTier(scoreNum, input.rules.scoring)
  } else {
    return null
  }

  const reasoning: ClassificationResult['reasoning'] = { notes: [] }
  if (isPlainObject(raw.reasoning)) {
    const r = raw.reasoning
    if (Array.isArray(r.matchedKeywords)) {
      reasoning.matchedKeywords = (r.matchedKeywords as unknown[])
        .filter((s) => typeof s === 'string')
        .map((s) => s as string)
    }
    if (Array.isArray(r.matchedTriggers)) {
      reasoning.matchedTriggers = (r.matchedTriggers as unknown[])
        .filter((s) => typeof s === 'string')
        .map((s) => s as string)
    }
    if (Array.isArray(r.suppressedBy)) {
      reasoning.suppressedBy = (r.suppressedBy as unknown[])
        .filter((s) => typeof s === 'string')
        .map((s) => s as string)
    }
    if (Array.isArray(r.topAlternatives)) {
      reasoning.topAlternatives = (r.topAlternatives as unknown[])
        .filter(isPlainObject)
        .map((alt) => ({
          folder: typeof alt.folder === 'string' ? alt.folder : '',
          score: typeof alt.score === 'number' ? clamp01(alt.score) : 0
        }))
        .filter((a) => a.folder.length > 0)
    }
    if (Array.isArray(r.notes)) {
      reasoning.notes = (r.notes as unknown[])
        .filter((s) => typeof s === 'string')
        .map((s) => s as string)
    }
  }

  return {
    classifierId: 'ai-gemini-v1',
    provider: 'gemini',
    title,
    category,
    subcategory,
    tags: tagsArr,
    reuse,
    scope,
    recommendedFolder,
    filename,
    confidence: { score: scoreNum, tier },
    reasoning
  }
}

export interface GeminiCallOptions {
  apiKey: string
  model?: string
  // For tests, allow injecting a fetch-like callable.
  fetchImpl?: typeof fetch
}

export async function callGemini(
  input: ClassificationInput,
  opts: GeminiCallOptions
): Promise<GeminiClassifyResult> {
  if (!opts.apiKey) return err('no-key', 'No Gemini API key configured.')

  const model = opts.model || DEFAULT_GEMINI_MODEL
  const fetchFn = opts.fetchImpl ?? fetch
  const { systemInstruction, userPrompt } = buildGeminiPrompt(input)

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: MAX_OUTPUT_TOKENS
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let resp: Response
  try {
    resp = await fetchFn(resolveEndpoint(model), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Per current docs: use header, not URL query string.
        'x-goog-api-key': opts.apiKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (e) {
    clearTimeout(timer)
    const ex = e as Error
    if (ex.name === 'AbortError') return err('timeout', 'Gemini request timed out.')
    return err('network', `Gemini network error: ${ex.message}`)
  }
  clearTimeout(timer)

  if (resp.status === 401 || resp.status === 403) {
    return err('auth', `Gemini auth failed (${resp.status}). Check the API key.`)
  }
  if (resp.status === 429) return err('rate-limit', 'Gemini rate limit hit.')
  if (!resp.ok) {
    let msg = `Gemini HTTP ${resp.status}`
    try {
      const txt = await resp.text()
      if (txt) msg += `: ${txt.slice(0, 240)}`
    } catch {
      // ignore
    }
    return err('unknown', msg)
  }

  let json: GeminiResponse
  try {
    json = (await resp.json()) as GeminiResponse
  } catch (e) {
    return err('parse', `Could not parse Gemini envelope: ${(e as Error).message}`)
  }

  const cand = json.candidates?.[0]
  if (!cand) return err('parse', 'Gemini returned no candidates.')
  const finish = (cand.finishReason || '').toUpperCase()
  if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT') {
    return err('safety-blocked', 'Gemini blocked the response for safety/policy reasons.')
  }
  const text = cand.content?.parts?.[0]?.text
  if (typeof text !== 'string' || text.length === 0) {
    return err('parse', 'Gemini returned no text part.')
  }

  let parsed: unknown
  try {
    parsed = safeParseJson(text)
  } catch (e) {
    return err('parse', `Gemini output was not valid JSON: ${(e as Error).message}`)
  }

  const normalized = normalizeGeminiResult(parsed, input)
  if (!normalized) {
    return err(
      'parse',
      'Gemini output did not match the required shape (invented folder/category, missing fields, or bad enum).'
    )
  }
  return { ok: true, result: normalized }
}

export interface GeminiClassifierFactoryDeps {
  resolveApiKey: () => Promise<string | null>
  resolveModel: () => string
}

// Build a Classifier that lazily resolves the key/model. The router calls
// this on every classify request so user setting changes take effect
// immediately.
export function makeGeminiClassifier(deps: GeminiClassifierFactoryDeps): Classifier {
  return {
    id: 'ai-gemini-v1',
    provider: 'gemini',
    async classify(input) {
      const key = await deps.resolveApiKey()
      if (!key) {
        // We surface no-key as a thrown ClassifierError-shaped object so
        // the router can propagate it through ClassifyResponse.
        const e: ClassifierError = { code: 'no-key', message: 'Gemini key not configured.' }
        throw e
      }
      const model = deps.resolveModel()
      const out = await callGemini(input, { apiKey: key, model })
      if (!out.ok) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw out.error
      }
      return out.result
    }
  }
}
