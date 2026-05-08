import { useState } from 'react'
import type { CheckRootResult, InitResult } from '../../shared/ipc'

type Mode = 'pick' | 'use-existing' | 'create-new'

interface Props {
  checkResult: CheckRootResult
  onComplete: (rootPath: string) => void
  // Optional escape hatch. When provided, a "Back to current library" button is
  // rendered on the pick screen so the user can bail out of re-onboarding
  // without abandoning a still-valid current root. Should only be supplied
  // when there is in fact a valid current root to return to (i.e. the user
  // navigated here voluntarily, not because of missing-root recovery).
  onCancel?: () => void
}

function recoveryBanner(check: CheckRootResult): string | null {
  if (check.ok) return null
  if (check.reason === 'unset') return null // first run, no banner
  if (check.reason === 'missing') {
    return `We could not find your saved library at ${check.rootPath}. Pick a folder to continue, or restore the missing one and reopen.`
  }
  if (check.reason === 'not-directory') {
    return `Your saved library path ${check.rootPath} is no longer a folder. Pick a different folder to continue.`
  }
  return `Could not load saved library: ${check.error ?? 'unknown error'}`
}

export default function Onboarding({ checkResult, onComplete, onCancel }: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>('pick')
  const [pickedPath, setPickedPath] = useState<string | null>(null)
  const [initStructure, setInitStructure] = useState<boolean>(true)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [initSummary, setInitSummary] = useState<InitResult | null>(null)

  const banner = recoveryBanner(checkResult)

  function reset(): void {
    setMode('pick')
    setPickedPath(null)
    setInitStructure(true)
    setError(null)
    setInitSummary(null)
  }

  async function pickFolder(targetMode: 'use-existing' | 'create-new'): Promise<void> {
    setBusy(true)
    setError(null)
    setInitSummary(null)
    try {
      const picked = await window.api.chooseFolder(
        checkResult.ok ? checkResult.rootPath : undefined
      )
      if (!picked) {
        // User cancelled - stay where they were
        return
      }
      setPickedPath(picked)
      setMode(targetMode)
      // Sensible default: init ON for "create new", OFF for "use existing"
      setInitStructure(targetMode === 'create-new')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function confirm(): Promise<void> {
    if (!pickedPath) return
    setBusy(true)
    setError(null)
    try {
      if (initStructure) {
        const result = await window.api.initLibrary(pickedPath)
        setInitSummary(result)
        if (!result.ok) {
          setError(`Library initialization had errors. See details below. You can try again or pick a different folder.`)
          return
        }
      }
      await window.api.setRootPath(pickedPath)
      onComplete(pickedPath)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-brand">Prompt Librarian</div>
        <h1 className="onboarding-title">
          {mode === 'pick' ? 'Set up your prompt library' : 'Confirm your library'}
        </h1>
        <p className="onboarding-truth">
          Local Markdown files in this folder are the source of truth.
        </p>

        {banner && <div className="onboarding-banner">{banner}</div>}

        {mode === 'pick' && (
          <>
            <div className="onboarding-choices">
              <section className="onboarding-choice">
                <h2>Use an existing prompt library</h2>
                <p className="dim">
                  Pick a folder you already have. Nothing inside it will be deleted or
                  rearranged.
                </p>
                <button
                  className="onboarding-primary"
                  disabled={busy}
                  onClick={() => pickFolder('use-existing')}
                >
                  Choose folder
                </button>
              </section>

              <section className="onboarding-choice">
                <h2>Create a new prompt library</h2>
                <p className="dim">
                  Pick or create a folder. The default folder structure can be added in one
                  step.
                </p>
                <button
                  className="onboarding-primary"
                  disabled={busy}
                  onClick={() => pickFolder('create-new')}
                >
                  Choose or create folder
                </button>
              </section>
            </div>

            {onCancel && (
              <div className="onboarding-actions onboarding-cancel-row">
                <button
                  type="button"
                  className="onboarding-secondary"
                  disabled={busy}
                  onClick={onCancel}
                >
                  Back to current library
                </button>
              </div>
            )}
          </>
        )}

        {mode !== 'pick' && pickedPath && (
          <div className="onboarding-confirm">
            <div className="onboarding-field">
              <div className="phase1-label">Library root</div>
              <div className="phase1-value">{pickedPath}</div>
            </div>

            <label className="onboarding-checkbox">
              <input
                type="checkbox"
                checked={initStructure}
                onChange={(e) => setInitStructure(e.target.checked)}
                disabled={busy}
              />
              <span>
                Initialize the default folder structure
                <span className="dim">
                  {' '}
                  - creates only missing folders, never overwrites or deletes anything.
                </span>
              </span>
            </label>

            {initSummary && (
              <div className="onboarding-summary">
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
              </div>
            )}

            {error && <div className="onboarding-error">{error}</div>}

            <div className="onboarding-actions">
              <button onClick={reset} disabled={busy} className="onboarding-secondary">
                Back
              </button>
              <button onClick={confirm} disabled={busy} className="onboarding-primary">
                {busy ? 'Working...' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
