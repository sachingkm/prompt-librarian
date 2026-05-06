import Phase1TestPanel from './Phase1TestPanel'

function App(): JSX.Element {
  return (
    <div className="shell">
      <header className="title-bar">
        <span className="brand">Prompt Librarian</span>
        <span className="phase-tag">Phase 1 - filesystem IPC test surface</span>
      </header>

      <main className="main main-phase1">
        <Phase1TestPanel />
      </main>

      <footer className="status-bar">
        <span>electron-vite + react + typescript</span>
        <span className="dim">phase 1 - dev test surface only</span>
      </footer>
    </div>
  )
}

export default App
