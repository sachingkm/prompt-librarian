import { useCallback, useEffect, useState } from 'react'
import type { AiStatus, InitResult, RulesPayload } from '../../shared/ipc'
import type { ClassifierProvider } from '../../shared/classifier'

interface Props {
  rootPath: string
  onClose: () => void
  onRootChanged: (newRoot: string) => void
}

export default function Settings({ rootPath, onClose, onRootChanged }: Props): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [initSummary, setInitSummary] = useState<InitResult | null>(null)

  // Phase 4A additions: rules + Gemini status.
  const [rulesPayload, setRulesPayload] = useState<RulesPayload | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [provider, setProvider] = useState<ClassifierProvider>('deterministic')
  const [keyInput, setKeyInput] = useState('')
  const [keyMessage, setKeyMessage] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)

  const refreshAiAndRules = useCallback(async () => {
    try {
      const [status, prov, rules] = await Promise.all([
        window.api.getAiStatus(),
        window.api.getClassifierProvider(),
        window.api.getRules()
      ])
      setAiStatus(status)
      setProvider(prov)
      setRulesPayload(rules)
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

  async function changeProvider(p: ClassifierProvider): Promise<void> {
    setBusy(true)
    try {
      await window.api.setClassifierProvider(p)
      setProvider(p)
      const status = await window.api.getAiStatus()
      setAiStatus(status)
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
                  value="deterministic"
                  checked={provider === 'deterministic'}
                  onChange={() => void changeProvider('deterministic')}
                />
                Deterministic (default, offline, free)
              </label>
              <label className="radio-row">
                <input
                  type="radio"
                  name="classifierProvider"
                  value="gemini"
                  checked={provider === 'gemini'}
                  onChange={() => void changeProvider('gemini')}
                  disabled={!aiStatus?.geminiAvailable}
                />
                Google Gemini (free tier available, requires API key)
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
            &quot;Improve with Gemini&quot;. Per current Google docs, free-tier requests may be
            used to improve Google products; paid-tier requests are not.
          </p>
        </section>

        <p className="dim modal-foot">
          Local Markdown files in this folder are the source of truth.
        </p>
      </div>
    </div>
  )
}
