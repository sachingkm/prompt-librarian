// Phase 4A intake. The user pastes raw text, runs deterministic classify,
// optionally runs Gemini "improve", reviews/edits, and saves. No autosave;
// save uses the existing prompt:save IPC.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AiStatus, RulesPayload, SaveResult } from '../../../shared/ipc'
import type {
  ClassificationResult,
  ClassifierError,
  ReuseLevel,
  Scope
} from '../../../shared/classifier'
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
  freeTierDisclosure: boolean
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
  const [confirmGemini, setConfirmGemini] = useState<ConfirmGeminiState>({
    open: false,
    freeTierDisclosure: false
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

  const handleClassify = useCallback(async (): Promise<void> => {
    if (rawText.trim().length === 0) return
    setBusy(true)
    setError(null)
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
      setStage('review')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [rawText])

  const runGemini = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
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
      setClassification(resp.result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [rawText, classification])

  const handleImproveWithGemini = useCallback((): void => {
    if (!aiAvailable) return
    if (geminiAcknowledgedRef.current) {
      void runGemini()
      return
    }
    setConfirmGemini({ open: true, freeTierDisclosure: aiStatus?.keySource !== 'env' })
  }, [aiAvailable, aiStatus, runGemini])

  const acceptGemini = useCallback((): void => {
    geminiAcknowledgedRef.current = true
    setConfirmGemini({ open: false, freeTierDisclosure: false })
    void runGemini()
  }, [runGemini])

  const handleSave = useCallback(
    async (
      draftFields: ClassificationResult,
      collisionStrategy: 'fail' | 'overwrite' | 'rename',
      newFilename?: string
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
        onSaved({ relPath: result.relPath, path: result.path })
      }
      return result
    },
    [rawText, onSaved]
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
                {confirmGemini.freeTierDisclosure && (
                  <p className="dim">
                    Per current Google docs, free-tier Gemini requests may be used to improve
                    Google products. Paid-tier requests are not.
                  </p>
                )}
                <p className="dim">
                  No library files or local paths are sent. The deterministic suggestion is
                  included as a hint.
                </p>
                <div className="modal-actions">
                  <button
                    className="onboarding-secondary"
                    onClick={() => setConfirmGemini({ open: false, freeTierDisclosure: false })}
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
