import { useCallback, useEffect, useState } from 'react'
import type { AiStatus, InitResult, LearningSettings, RulesPayload } from '../../shared/ipc'
import type { ClassifierProvider } from '../../shared/classifier'
import { GEMINI_DISCLOSURE } from '../../shared/geminiDisclosure'

interface Props {
  rootPath: string
  onClose: () => void
  onRootChanged: (newRoot: string) => void
  onOpenEditor?: () => void
}

type ProviderChoice = 'auto' | 'deterministic' | 'gemini'

export default function Settings({ rootPath, onClose, onRootChanged, onOpenEditor }: Props): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [initSummary, setInitSummary] = useState<InitResult | null>(null)

  // Phase 4A additions: rules + Gemini status.
  const [rulesPayload, setRulesPayload] = useState<RulesPayload | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [providerChoice, setProviderChoice] = useState<ProviderChoice>('auto')
  const [keyInput, setKeyInput] = useState('')
  const [keyMessage, setKeyMessage] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)

  // Phase 4B: Learning section.
  const [learning, setLearning] = useState<LearningSettings | null>(null)
  const [confirmClearCorrections, setConfirmClearCorrections] = useState(false)

  const refreshAiAndRules = useCallback(async () => {
    try {
      const [status, rules, learningResp] = await Promise.all([
        window.api.getAiStatus(),
        window.api.getRules(),
        window.api.getLearningSettings()
      ])
      setAiStatus(status)
      setRulesPayload(rules)
      setLearning(learningResp)
      // Provider choice = 'auto' when no manual override is set.
      setProviderChoice(status.manualOverride ?? 'auto')
    } catch (err) {
      setRulesError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void refreshAiAndRules()
  }, [refreshAiAndRules])

  async function changeRoot(): Promise<void> {
    setBusy(true)
    setError(null)
    setInfo(null)
    setInitSummary(null)
    try {
      const picked = await window.api.chooseFolder(rootPath)
      if (!picked) return
      await window.api.setRootPath(picked)
      onRootChanged(picked)
      setInfo(
        'Root changed. Initialize the default folder structure if this is a new library.'
      )
      void refreshAiAndRules()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function reinit(): Promise<void> {
    setBusy(true)
    setError(null)
    setInfo(null)
    setInitSummary(null)
    try {
      const result = await window.api.initLibrary(rootPath)
      setInitSummary(result)
      if (!result.ok) {
        setError('Initialization completed with errors - see details below.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function reloadRules(): Promise<void> {
    setBusy(true)
    setRulesError(null)
    try {
      const rules = await window.api.reloadRules()
      setRulesPayload(rules)
    } catch (err) {
      setRulesError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openRules(): Promise<void> {
    setRulesError(null)
    try {
      const result = await window.api.openRulesInEditor()
      if (!result.ok) setRulesError(result.error ?? 'Could not open rules.json.')
    } catch (err) {
      setRulesError((err as Error).message)
    }
  }

  async function resetRules(): Promise<void> {
    setBusy(true)
    setRulesError(null)
    try {
      const result = await window.api.resetRules()
      if (!result.ok) {
        setRulesError(result.error ?? 'Reset failed.')
      } else {
        await refreshAiAndRules()
      }
    } catch (err) {
      setRulesError((err as Error).message)
    } finally {
      setBusy(false)
      setConfirmReset(false)
    }
  }

  async function changeProvider(choice: ProviderChoice): Promise<void> {
    setBusy(true)
    try {
      await window.api.setClassifierProvider(choice)
      setProviderChoice(choice)
      const status = await window.api.getAiStatus()
      setAiStatus(status)
    } finally {
      setBusy(false)
    }
  }

  // Phase 4B Learning helpers.
  async function toggleLearning(field: keyof LearningSettings, value: boolean): Promise<void> {
    setBusy(true)
    try {
      const updated = await window.api.setLearningSettings({ [field]: value })
      setLearning(updated)
    } finally {
      setBusy(false)
    }
  }

  async function analyzeCorrections(): Promise<void> {
    setBusy(true)
    try {
      const r = await window.api.analyzeCorrections()
      setKeyMessage(`Analyzed corrections - created ${r.created.length} proposal(s).`)
      const learn = await window.api.getLearningSettings()
      setLearning(learn)
    } finally {
      setBusy(false)
    }
  }

  async function clearCorrectionHistory(): Promise<void> {
    setBusy(true)
    try {
      await window.api.clearCorrections()
      const learn = await window.api.getLearningSettings()
      setLearning(learn)
      setConfirmClearCorrections(false)
      setKeyMessage('Correction history cleared.')
    } finally {
      setBusy(false)
    }
  }

  async function exportRules(): Promise<void> {
    setBusy(true)
    setRulesError(null)
    try {
      const r = await window.api.exportRules()
      if (!r.ok) {
        if (r.error) setRulesError(r.error)
      } else if (r.path) {
        setKeyMessage(`Exported rules.json to ${r.path}`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function importRules(): Promise<void> {
    setBusy(true)
    setRulesError(null)
    try {
      const r = await window.api.importRules()
      if (!r.ok) {
        if (r.error) setRulesError(r.error)
      } else if (r.rules) {
        setRulesPayload(r.rules)
        setKeyMessage('Rules imported.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function saveKey(): Promise<void> {
    if (keyInput.trim().length === 0) return
    setBusy(true)
    setKeyMessage(null)
    try {
      const result = await window.api.setGeminiApiKey(keyInput.trim())
      if (result.ok) {
        setKeyInput('')
        setKeyMessage('Key saved. It is stored encrypted on this machine.')
      } else if (result.error === 'secret-storage-unavailable') {
        setKeyMessage(
          'OS keychain encryption is unavailable on this machine. Set PROMPT_LIBRARIAN_GEMINI_API_KEY for this session instead.'
        )
      } else {
        setKeyMessage(result.message ?? 'Could not save key.')
      }
      const status = await window.api.getAiStatus()
      setAiStatus(status)
    } finally {
      setBusy(false)
    }
  }

  async function clearKey(): Promise<void> {
    setBusy(true)
    setKeyMessage(null)
    try {
      await window.api.clearGeminiApiKey()
      setKeyMessage('Stored key cleared.')
      const status = await window.api.getAiStatus()
      setAiStatus(status)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal-panel settings-panel">
        <header className="modal-head">
          <h2>Settings</h2>
          <button onClick={onClose} disabled={busy} className="onboarding-secondary">
            Close
          </button>
        </header>

        <section className="modal-section">
          <div className="phase1-label">Library root</div>
          <div className="phase1-value">{rootPath}</div>
          <div className="modal-actions">
            <button onClick={changeRoot} disabled={busy} className="onboarding-primary">
              Change root folder...
            </button>
            <button onClick={reinit} disabled={busy} className="onboarding-secondary">
              Re-initialize default structure
            </button>
          </div>
        </section>

        {info && (
          <section className="modal-section">
            <div className="onboarding-info">{info}</div>
          </section>
        )}

        {initSummary && (
          <section className="modal-section">
            <div className="phase1-label">Init result</div>
            <div className="dim">
              Created: {initSummary.created.length} - Already existed:{' '}
              {initSummary.alreadyExisted.length} - Errors: {initSummary.errors.length}
            </div>
            {initSummary.errors.length > 0 && (
              <ul className="onboarding-errors">
                {initSummary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {error && (
          <section className="modal-section">
            <div className="onboarding-error">{error}</div>
          </section>
        )}

        {/* Classification rules */}
        <section className="modal-section">
          <div className="phase1-label">Classification rules</div>
          {rulesPayload ? (
            <>
              <div className="phase1-value">{rulesPayload.path}</div>
              {rulesPayload.usingDefaults && (
                <div className="onboarding-error">
                  Rules file is invalid; using defaults for this session. Your file on disk
                  was not overwritten.
                </div>
              )}
              {rulesPayload.usingDefaults &&
                rulesPayload.validation.errors.length > 0 && (
                  <ul className="onboarding-errors">
                    {rulesPayload.validation.errors.slice(0, 8).map((e, i) => (
                      <li key={i}>
                        <code>{e.path || '/'}</code>: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              <div className="modal-actions">
                {onOpenEditor && (
                  <button
                    className="onboarding-primary"
                    onClick={onOpenEditor}
                    disabled={busy}
                  >
                    Open editor
                  </button>
                )}
                <button className="onboarding-secondary" onClick={openRules} disabled={busy}>
                  Open rules.json
                </button>
                <button className="onboarding-secondary" onClick={reloadRules} disabled={busy}>
                  Reload rules
                </button>
                <button
                  className="onboarding-secondary"
                  onClick={() => setConfirmReset(true)}
                  disabled={busy}
                >
                  Reset to defaults...
                </button>
                <button className="onboarding-secondary" onClick={exportRules} disabled={busy}>
                  Export...
                </button>
                <button className="onboarding-secondary" onClick={importRules} disabled={busy}>
                  Import...
                </button>
              </div>
              {rulesError && (
                <div className="onboarding-error">{rulesError}</div>
              )}
            </>
          ) : (
            <div className="dim">Loading rules...</div>
          )}
        </section>

        {confirmReset && (
          <section className="modal-section">
            <div className="onboarding-info">
              This overwrites <code>rules.json</code> with the default rules shipped with
              the app. Your edits will be lost.
            </div>
            <div className="modal-actions">
              <button
                className="onboarding-secondary"
                onClick={() => setConfirmReset(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="onboarding-primary" onClick={resetRules} disabled={busy}>
                Confirm reset
              </button>
            </div>
          </section>
        )}

        {/* Gemini AI */}
        <section className="modal-section">
          <div className="phase1-label">Gemini AI</div>
          <div className="form-grid">
            <label>Provider</label>
            <div>
              <label className="radio-row">
                <input
                  type="radio"
                  name="classifierProvider"
                  value="auto"
                  checked={providerChoice === 'auto'}
                  onChange={() => void changeProvider('auto')}
                />
                Auto (Gemini when configured, deterministic otherwise)
              </label>
              <label className="radio-row">
                <input
                  type="radio"
                  name="classifierProvider"
                  value="deterministic"
                  checked={providerChoice === 'deterministic'}
                  onChange={() => void changeProvider('deterministic')}
                />
                Deterministic (force offline, free)
              </label>
              <label className="radio-row">
                <input
                  type="radio"
                  name="classifierProvider"
                  value="gemini"
                  checked={providerChoice === 'gemini'}
                  onChange={() => void changeProvider('gemini')}
                  disabled={!aiStatus?.geminiAvailable}
                />
                Google Gemini (force, requires API key)
              </label>
            </div>

            <label>Status</label>
            <div className="dim">
              {aiStatus?.keySource === 'env' && 'Env key active (PROMPT_LIBRARIAN_GEMINI_API_KEY)'}
              {aiStatus?.keySource === 'stored' && 'Key stored on this machine (encrypted)'}
              {aiStatus?.keySource === 'none' && 'No key set'}
              {aiStatus?.model ? <span> &middot; Model: {aiStatus.model}</span> : null}
            </div>

            <label htmlFor="settings-gemini-key">API key</label>
            <input
              id="settings-gemini-key"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste your Gemini API key"
              autoComplete="off"
            />
          </div>
          <div className="modal-actions">
            <button
              className="onboarding-primary"
              onClick={saveKey}
              disabled={busy || keyInput.trim().length === 0}
            >
              Save key
            </button>
            <button
              className="onboarding-secondary"
              onClick={clearKey}
              disabled={busy || aiStatus?.keySource !== 'stored'}
            >
              Clear stored key
            </button>
          </div>
          {keyMessage && <div className="dim">{keyMessage}</div>}
          {aiStatus?.warnings.map((w, i) => (
            <div key={i} className="onboarding-error">
              {w}
            </div>
          ))}
          <p className="dim">
            Get a Gemini API key at <code>https://aistudio.google.com/apikey</code>. The key is
            stored encrypted via OS keychain when available, and is sent only when you click
            &quot;Improve with Gemini&quot;.
          </p>
          <p className="dim">{GEMINI_DISCLOSURE}</p>
        </section>

        {/* Phase 4B: Learning from corrections */}
        <section className="modal-section">
          <div className="phase1-label">Learning from corrections</div>
          {learning ? (
            <>
              <div className="dim">
                Corrections recorded: {learning.correctionCount} &middot; Pending proposals:{' '}
                {learning.pendingProposalCount}
              </div>
              <label className="radio-row">
                <input
                  type="checkbox"
                  checked={learning.suggestRuleAdditions}
                  onChange={(e) => void toggleLearning('suggestRuleAdditions', e.target.checked)}
                  disabled={busy}
                />
                Suggest rule additions from patterns
              </label>
              <label className="radio-row">
                <input
                  type="checkbox"
                  checked={learning.useCorrectionsAsExamples}
                  onChange={(e) =>
                    void toggleLearning('useCorrectionsAsExamples', e.target.checked)
                  }
                  disabled={busy}
                />
                Use recent corrections as Gemini examples
              </label>
              <div className="modal-actions">
                <button
                  className="onboarding-secondary"
                  onClick={analyzeCorrections}
                  disabled={busy || learning.correctionCount === 0}
                >
                  Analyze corrections
                </button>
                <button
                  className="onboarding-secondary"
                  onClick={() => setConfirmClearCorrections(true)}
                  disabled={busy || learning.correctionCount === 0}
                >
                  Clear correction history...
                </button>
                <button
                  className="onboarding-secondary"
                  onClick={() => void window.api.openLearningFolder()}
                  disabled={busy}
                >
                  Open learning folder
                </button>
              </div>
              {confirmClearCorrections && (
                <div className="onboarding-info">
                  This permanently deletes <code>corrections.jsonl</code>. Your saved prompts
                  and rules.json are not affected.
                  <div className="modal-actions">
                    <button
                      className="onboarding-secondary"
                      onClick={() => setConfirmClearCorrections(false)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      className="onboarding-primary"
                      onClick={clearCorrectionHistory}
                      disabled={busy}
                    >
                      Confirm clear
                    </button>
                  </div>
                </div>
              )}
              <p className="dim">
                Prompt Librarian records your review corrections locally so it can suggest
                better rules. It does not change your taxonomy unless you approve.
              </p>
            </>
          ) : (
            <div className="dim">Loading learning settings...</div>
          )}
        </section>

        <p className="dim modal-foot">
          Local Markdown files in this folder are the source of truth.
        </p>
      </div>
    </div>
  )
}
