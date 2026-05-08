import { useState } from 'react'
import LibraryBrowser from './library/LibraryBrowser'
import Phase1TestPanel from './Phase1TestPanel'
import Settings from './Settings'

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
  const [devOpen, setDevOpen] = useState(false)

  return (
    <div className="shell">
      <header className="title-bar">
        <span className="brand">Prompt Librarian</span>
        <span className="phase-tag">Phase 3 - read-only library browser</span>
        <span className="title-bar-actions">
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
          key={rootPath} forces LibraryBrowser to unmount and remount when the
          saved root changes (via Settings -> Change root folder, or via the
          "Pick a different library" onboarding flow). The remount re-runs the
          initial library:scan, so the sidebar counts and folder tree refresh
          automatically without the user having to click "Refresh from disk".
          Within a single root, LibraryBrowser preserves its own state across
          re-renders.
        */}
        <LibraryBrowser key={rootPath} />
      </main>

      <footer className="status-bar">
        <span>electron-vite + react + typescript</span>
        <span className="dim">root: {rootPath}</span>
      </footer>

      {settingsOpen && (
        <Settings
          rootPath={rootPath}
          onClose={() => setSettingsOpen(false)}
          // Propagate the new root to App so the main shell behind the modal
          // updates immediately, but DO NOT close the modal here. The user
          // should be able to click "Re-initialize default structure" right
          // after picking a new library, without losing context. Settings
          // closes only when the user clicks Close.
          onRootChanged={(p) => onRootChanged(p)}
        />
      )}

      {/*
        Phase 1 test surface stays available in dev only, behind a floating
        disclosure pinned to the bottom-right. Production builds get neither
        the JSX nor the imported module (Vite tree-shakes the static import
        when the only reference is dead code under `import.meta.env.DEV`).
        It sits outside the normal app flow: collapsed by default, never
        intrudes on the library browser layout.
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
