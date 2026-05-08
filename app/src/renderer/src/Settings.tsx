import { useState } from 'react'
import type { InitResult } from '../../shared/ipc'

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

  async function changeRoot(): Promise<void> {
    setBusy(true)
    setError(null)
    setInfo(null)
    setInitSummary(null)
    try {
      const picked = await window.api.chooseFolder(rootPath)
      if (!picked) return
      await window.api.setRootPath(picked)
      // Tell App about the new root so the main shell behind the modal
      // updates. The modal itself stays open (MainShell no longer closes it
      // here) so the user can immediately click Re-initialize for the new
      // root if they want to.
      onRootChanged(picked)
      setInfo(
        'Root changed. Initialize the default folder structure if this is a new library.'
      )
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

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal-panel">
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

        <p className="dim modal-foot">
          Local Markdown files in this folder are the source of truth.
        </p>
      </div>
    </div>
  )
}
