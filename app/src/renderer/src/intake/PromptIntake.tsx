// Phase 4A/4B intake. The user pastes raw text, runs deterministic OR
// Gemini classify, reviews/edits, and saves. No autosave; save uses the
// existing prompt:save IPC. After save, if the user changed any
// classification field versus the suggestion, a correction is appended
// to corrections.jsonl through the classifier IPC layer.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AiStatus,
  ClassifyFallbackMarker,
  RulesPayload,
  SaveResult
} from '../../../shared/ipc'
import type {
  ClassificationResult,
  ClassifierError,
  ReuseLevel,
  Scope
} from '../../../shared/classifier'
import type { CorrectionMetadata } from '../../../shared/correction'
import type { DuplicateMatch } from '../../../shared/dedup'
import { GEMINI_DISCLOSURE } from '../../../shared/geminiDisclosure'
import ClassificationReview from './ClassificationReview'

interface Props {
  onClose: () => void
  // Called once a save succeeds. Parent decides what to do next (e.g.
  // refresh the library browser, select the saved prompt).
  onSaved: (result: { relPath: string; path: string }) => void
}

type Stage = 'compose' | 'review'

interface ConfirmGeminiState {
  open: boolean
}

function nowIso(): string {
  return new Date().toISOString()
}

export default function PromptIntake({ onClose, onSaved }: Props): JSX.Element {
  const [stage, setStage] = useState<Stage>('compose')
  const [rawText, setRawText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [rulesPayload, setRulesPayload] = useState<RulesPayload | null>(null)
  const [classification, setClassification] = useState<ClassificationResult | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  // Phase 4B: keep the original classifier suggestion separate from the
  // (mutated by user) classification so corrections.jsonl can record the
  // actual diff between suggested and accepted.
  const [suggestedBaseline, setSuggestedBaseline] = useState<ClassificationResult | null>(null)
  // Phase 4B: stash any fallback marker returned alongside the result.
  const [fallback, setFallback] = useState<ClassifyFallbackMarker | null>(null)
  // Phase 4B: when a Gemini fallback to deterministic happens, the user
  // can compare the deterministic result side-by-side. This holds the
  // unaltered deterministic.
  const [deterministicSnapshot, setDeterministicSnapshot] = useState<ClassificationResult | null>(
    null
  )
  // Phase 4B: local duplicate matches for the pasted body. Populated after
  // a successful classify; surfaced as a non-blocking warning in review.
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [confirmGemini, setConfirmGemini] = useState<ConfirmGeminiState>({
    open: false
  })
  const geminiAcknowledgedRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Boot: fetch AI status, current rules, current folders.
  useEffect(() => {
    void (async () => {
      try {
        const [status, rules, folderList] = await Promise.all([
          window.api.getAiStatus(),
          window.api.getRules(),
          window.api.listFolders().catch(() => [] as string[])
        ])
        setAiStatus(status)
        setRulesPayload(rules)
        setFolders(folderList)
      } catch (err) {
        setError((err as Error).message)
      }
    })()
  }, [])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const aiAvailable = useMemo(
    () => Boolean(aiStatus?.geminiAvailable),
    [aiStatus]
  )

  // Best-effort local duplicate check. Never blocks or throws into the
  // classify flow; on failure we just show no warning.
  const refreshDuplicates = useCallback(async (): Promise<void> => {
    try {
      const matches = await window.api.checkDuplicate(rawText)
      setDuplicates(matches)
    } catch {
      setDuplicates([])
    }
  }, [rawText])

  // Run a deterministic classify and advance to review.
  const runDeterministicClassify = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setFallback(null)
    try {
      const resp = await window.api.classify({
        rawText,
        provider: 'deterministic'
      })
      if (!resp.ok) {
        setError(formatClassifierError(resp.error))
        return
      }
      setClassification(resp.result)
      setSuggestedBaseline(resp.result)
      setDeterministicSnapshot(resp.result)
      void refreshDuplicates()
      setStage('review')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [rawText, refreshDuplicates])

  // Run a Gemini classify (router will run deterministic internally for the
  // hint) and advance to review. If Gemini fails, the response still has
  // ok=true with the deterministic fallback and a fallback marker.
  const runGeminiClassifyToReview = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setFallback(null)
    try {
      // Always grab a fresh deterministic snapshot for compare-mode.
      const detResp = await window.api.classify({ rawText, provider: 'deterministic' })
      if (detResp.ok) setDeterministicSnapshot(detResp.result)

      const resp = await window.api.classify({ rawText, provider: 'gemini' })
      if (!resp.ok) {
        setError(formatClassifierError(resp.error))
        return
      }
      if (resp.fallback) setFallback(resp.fallback)
      setClassification(resp.result)
      setSuggestedBaseline(resp.result)
      void refreshDuplicates()
      setStage('review')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [rawText, refreshDuplicates])

  // "Improve" path used from the review stage (deterministic already ran).
  const runGeminiImprove = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setFallback(null)
    try {
      const resp = await window.api.classify({
        rawText,
        provider: 'gemini',
        deterministicHint: classification ?? undefined
      })
      if (!resp.ok) {
        setError(formatClassifierError(resp.error))
        return
      }
      if (resp.fallback) setFallback(resp.fallback)
      setClassification(resp.result)
      setSuggestedBaseline(resp.result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [rawText, classification])

  // After the disclosure is acknowledged, this fires the actual Gemini
  // call. The pendingGeminiAction discriminates compose-stage classify
  // (advance to review) vs review-stage improve (refine in place).
  const pendingGeminiActionRef = useRef<'classify' | 'improve'>('classify')

  const handleClassify = useCallback((): void => {
    if (rawText.trim().length === 0) return
    // Honour the saved provider. If Gemini is selected AND available, send
    // straight to Gemini (after the first-use disclosure). Otherwise run
    // deterministic locally.
    const useGemini = aiStatus?.provider === 'gemini' && Boolean(aiStatus?.geminiAvailable)
    if (!useGemini) {
      void runDeterministicClassify()
      return
    }
    if (geminiAcknowledgedRef.current) {
      void runGeminiClassifyToReview()
      return
    }
    pendingGeminiActionRef.current = 'classify'
    setConfirmGemini({ open: true })
  }, [rawText, aiStatus, runDeterministicClassify, runGeminiClassifyToReview])

  const handleImproveWithGemini = useCallback((): void => {
    if (!aiAvailable) return
    if (geminiAcknowledgedRef.current) {
      void runGeminiImprove()
      return
    }
    pendingGeminiActionRef.current = 'improve'
    setConfirmGemini({ open: true })
  }, [aiAvailable, runGeminiImprove])

  const acceptGemini = useCallback((): void => {
    geminiAcknowledgedRef.current = true
    setConfirmGemini({ open: false })
    if (pendingGeminiActionRef.current === 'classify') {
      void runGeminiClassifyToReview()
    } else {
      void runGeminiImprove()
    }
  }, [runGeminiClassifyToReview, runGeminiImprove])

  const handleSave = useCallback(
    async (
      draftFields: ClassificationResult,
      collisionStrategy: 'fail' | 'overwrite' | 'rename',
      newFilename?: string,
      addToTaxonomy?: boolean
    ): Promise<SaveResult> => {
      const created_at = nowIso()
      const updated_at = created_at
      const draft = {
        folder: draftFields.recommendedFolder,
        filename: draftFields.filename,
        frontmatter: {
          title: draftFields.title,
          category: draftFields.category,
          subcategory: draftFields.subcategory,
          tags: draftFields.tags,
          reuse: draftFields.reuse as ReuseLevel,
          scope: draftFields.scope as Scope,
          created_at,
          updated_at
        },
        body: rawText
      }
      const opts: { strategy: 'fail' | 'overwrite' | 'rename'; newFilename?: string } = {
        strategy: collisionStrategy
      }
      if (collisionStrategy === 'rename' && newFilename) {
        opts.newFilename = newFilename
      }
      const result = await window.api.savePrompt(draft, opts)
      if (result.ok && result.path && result.relPath) {
        // Phase 4B: post-save taxonomy add. Only fires when the user
        // explicitly checked the inline "add to taxonomy" box and the
        // save itself succeeded. Failure here is non-fatal.
        if (addToTaxonomy && rulesPayload) {
          try {
            const baseId = draftFields.category
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
            const existingIds = new Set(rulesPayload.rules.categories.map((c) => c.id))
            let id = baseId.length > 0 ? baseId : 'new-category'
            let n = 2
            while (existingIds.has(id)) {
              id = `${baseId}-${n++}`
            }
            const nextRules = {
              ...rulesPayload.rules,
              categories: [
                ...rulesPayload.rules.categories,
                {
                  id,
                  label: draftFields.category,
                  folder: draftFields.recommendedFolder,
                  enabled: true,
                  priority: 0,
                  keywords: [],
                  tags: draftFields.tags.slice(0, 4)
                }
              ]
            }
            const written = await window.api.writeRules(nextRules)
            if (written.validation.ok) {
              setRulesPayload(written)
            }
          } catch {
            // non-fatal: prompt saved regardless of taxonomy write
          }
        }
        // Phase 4B: append a correction record IF the user accepted
        // anything different from the suggested baseline. Best-effort -
        // we never block save on logging.
        if (suggestedBaseline) {
          const acceptedFilename =
            collisionStrategy === 'rename' && newFilename ? newFilename : draftFields.filename
          const accepted: CorrectionMetadata = {
            title: draftFields.title,
            category: draftFields.category,
            subcategory: draftFields.subcategory ?? '',
            tags: draftFields.tags,
            reuse: draftFields.reuse,
            scope: draftFields.scope,
            recommendedFolder: draftFields.recommendedFolder,
            filename: acceptedFilename
          }
          const suggested: CorrectionMetadata = {
            title: suggestedBaseline.title,
            category: suggestedBaseline.category,
            subcategory: suggestedBaseline.subcategory ?? '',
            tags: suggestedBaseline.tags,
            reuse: suggestedBaseline.reuse,
            scope: suggestedBaseline.scope,
            recommendedFolder: suggestedBaseline.recommendedFolder,
            filename: suggestedBaseline.filename
          }
          try {
            await window.api.appendCorrection({
              rawText,
              classifierId: suggestedBaseline.classifierId,
              provider: suggestedBaseline.provider,
              suggested,
              accepted,
              matchedKeywords: suggestedBaseline.reasoning.matchedKeywords,
              matchedTriggers: suggestedBaseline.reasoning.matchedTriggers
            })
          } catch {
            // best-effort; learning continues to work without this record
          }
        }
        onSaved({ relPath: result.relPath, path: result.path })
      }
      return result
    },
    [rawText, onSaved, suggestedBaseline, rulesPayload]
  )

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New prompt">
      <div className="modal-panel intake-panel">
        <header className="modal-head">
          <h2>New prompt</h2>
          <button onClick={onClose} disabled={busy} className="onboarding-secondary">
            Cancel
          </button>
        </header>

        {rulesPayload && rulesPayload.usingDefaults && (
          <section className="modal-section">
            <div className="onboarding-error">
              Rules file at <code>{rulesPayload.path}</code> is invalid. Default rules are in
              use for this session and the file on disk has not been overwritten. Open
              Settings to fix it.
            </div>
            <ul className="onboarding-errors">
              {rulesPayload.validation.errors.slice(0, 5).map((e, i) => (
                <li key={i}>
                  <code>{e.path || '/'}</code>: {e.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        {stage === 'compose' && (
          <section className="modal-section">
            <label className="phase1-label" htmlFor="intake-text">
              Paste your prompt
            </label>
            <textarea
              id="intake-text"
              ref={textareaRef}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw prompt text. The deterministic classifier runs locally with no API call."
              rows={14}
              disabled={busy}
              className="intake-textarea"
            />
            <div className="intake-status">
              <span className="dim">
                Provider: <strong>{aiStatus?.provider ?? 'deterministic'}</strong>
                {aiStatus && aiStatus.keySource !== 'none' ? (
                  <span> &middot; Gemini key: {aiStatus.keySource}</span>
                ) : (
                  <span> &middot; Gemini key: not set</span>
                )}
                {aiStatus?.model ? <span> &middot; Model: {aiStatus.model}</span> : null}
              </span>
            </div>
            {error && (
              <div className="onboarding-error">{error}</div>
            )}
            <div className="modal-actions">
              <button
                className="onboarding-primary"
                onClick={handleClassify}
                disabled={busy || rawText.trim().length === 0}
              >
                {busy ? 'Classifying...' : 'Classify'}
              </button>
            </div>
          </section>
        )}

        {stage === 'review' && classification && (
          <ClassificationReview
            classification={classification}
            folders={folders}
            rulesPayload={rulesPayload}
            aiStatus={aiStatus}
            busy={busy}
            error={error}
            fallback={fallback}
            deterministicSnapshot={deterministicSnapshot}
            duplicates={duplicates}
            onUpdate={(next) => setClassification(next)}
            onImproveWithGemini={aiAvailable ? handleImproveWithGemini : null}
            onBack={() => {
              setStage('compose')
              setError(null)
            }}
            onSave={handleSave}
          />
        )}

        {confirmGemini.open && (
          <div className="modal-backdrop nested" role="dialog" aria-modal="true">
            <div className="modal-panel">
              <header className="modal-head">
                <h2>Send prompt to Gemini?</h2>
              </header>
              <section className="modal-section">
                <p>
                  Gemini classification sends this pasted prompt and the allowed folder/rules
                  schema to the configured Gemini API provider. Local deterministic classification
                  does not.
                </p>
                <p className="dim">{GEMINI_DISCLOSURE}</p>
                <p className="dim">
                  No library files or local paths are sent. The deterministic suggestion is
                  included as a hint.
                </p>
                <div className="modal-actions">
                  <button
                    className="onboarding-secondary"
                    onClick={() => setConfirmGemini({ open: false })}
                  >
                    Cancel
                  </button>
                  <button className="onboarding-primary" onClick={acceptGemini}>
                    Send to Gemini
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatClassifierError(e: ClassifierError): string {
  switch (e.code) {
    case 'no-key':
      return 'No Gemini API key configured. Set one in Settings or use deterministic classification.'
    case 'auth':
      return e.message
    case 'rate-limit':
      return 'Gemini rate limit reached. Try again shortly or use deterministic classification.'
    case 'network':
      return e.message
    case 'parse':
      return e.message
    case 'timeout':
      return 'Gemini request timed out. Try again or use deterministic classification.'
    case 'safety-blocked':
      return 'Gemini blocked the response for safety/policy reasons.'
    case 'secret-storage-unavailable':
      return 'OS keychain encryption is unavailable. Set PROMPT_LIBRARIAN_GEMINI_API_KEY for this session.'
    case 'rules-invalid':
      return e.message
    default:
      return e.message
  }
}
