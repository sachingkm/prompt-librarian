import { useState } from 'react'
import Phase1TestPanel from './Phase1TestPanel'
import Settings from './Settings'

interface Props {
  rootPath: string
  onRootChanged: (newRoot: string) => void
  onChangeRoot: () => void
}

export default function MainShell({ rootPath, onRootChanged, onChangeRoot }: Props): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [devOpen, setDevOpen] = useState(false)

  return (
    <div className="shell">
      <header className="title-bar">
        <span className="brand">Prompt Librarian</span>
        <span className="phase-tag">Phase 2 - shell + onboarding</span>
        <span className="title-bar-actions">
          <button onClick={() => setSettingsOpen(true)} className="onboarding-secondary">
            Settings
          </button>
        </span>
      </header>

      <main className="main main-shell">
        <div className="main-shell-card">
          <h1>Library is ready</h1>
          <p className="dim">
            Local Markdown files in this folder are the source of truth.
          </p>
          <div className="main-shell-rootline">
            <div className="phase1-label">Library root</div>
            <div className="phase1-value">{rootPath}</div>
          </div>
          <p className="lead">Library browser coming in Phase 3.</p>
          <div className="main-shell-links">
            <button onClick={() => setSettingsOpen(true)} className="onboarding-secondary">
              Open Settings
            </button>
            <button onClick={onChangeRoot} className="onboarding-secondary">
              Pick a different library
            </button>
          </div>
        </div>

        <details className="dev-section" open={devOpen} onToggle={(e) => setDevOpen((e.target as HTMLDetailsElement).open)}>
          <summary>Phase 1 test surface (developer / smoke tests)</summary>
          {devOpen && <Phase1TestPanel />}
        </details>
      </main>

      <footer className="status-bar">
        <span>electron-vite + react + typescript</span>
        <span className="dim">root: {rootPath}</span>
      </footer>

      {settingsOpen && (
        <Settings
          rootPath={rootPath}
          onClose={() => setSettingsOpen(false)}
          onRootChanged={(p) => {
            setSettingsOpen(false)
            onRootChanged(p)
          }}
        />
      )}
    </div>
  )
}
