import { useState } from 'react'
import LibraryBrowser from './library/LibraryBrowser'
import Phase1TestPanel from './Phase1TestPanel'
import Settings from './Settings'
import PromptIntake from './intake/PromptIntake'

interface Props {
  rootPath: string
  onRootChanged: (newRoot: string) => void
  onChangeRoot: () => void
}

export default function MainShell({
  rootPath,
  onRootChanged,
  onChangeRoot
}: Props): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [devOpen, setDevOpen] = useState(false)
  // Bumping this number forces LibraryBrowser to remount and rescan,
  // which we use after a successful save so the new prompt shows up.
  const [browserKeySalt, setBrowserKeySalt] = useState(0)

  return (
    <div className="shell">
      <header className="title-bar">
        <span className="brand">Prompt Librarian</span>
        <span className="phase-tag">Phase 4A - intake + classifier</span>
        <span className="title-bar-actions">
          <button
            type="button"
            onClick={() => setIntakeOpen(true)}
            className="onboarding-primary"
          >
            + New prompt
          </button>
          <button
            type="button"
            onClick={onChangeRoot}
            className="onboarding-secondary"
          >
            Pick a different library
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="onboarding-secondary"
          >
            Settings
          </button>
        </span>
      </header>

      <main className="main main-browser">
        {/*
          key combines rootPath and browserKeySalt: rootPath changes force
          a remount when the saved library changes (Phase 3); the salt
          forces a remount after a successful save so the new prompt is
          visible without the user having to click Refresh.
        */}
        <LibraryBrowser key={`${rootPath}#${browserKeySalt}`} />
      </main>

      <footer className="status-bar">
        <span>electron-vite + react + typescript</span>
        <span className="dim">root: {rootPath}</span>
      </footer>

      {settingsOpen && (
        <Settings
          rootPath={rootPath}
          onClose={() => setSettingsOpen(false)}
          onRootChanged={(p) => onRootChanged(p)}
        />
      )}

      {intakeOpen && (
        <PromptIntake
          onClose={() => setIntakeOpen(false)}
          onSaved={() => {
            setIntakeOpen(false)
            setBrowserKeySalt((n) => n + 1)
          }}
        />
      )}

      {/*
        Phase 1 test surface stays available in dev only, behind a floating
        disclosure pinned to the bottom-right.
      */}
      {import.meta.env.DEV && (
        <details
          className="dev-floating"
          open={devOpen}
          onToggle={(e) => setDevOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>Dev: Phase 1 test surface</summary>
          {devOpen && (
            <div className="dev-floating-body">
              <Phase1TestPanel />
            </div>
          )}
        </details>
      )}
    </div>
  )
}
