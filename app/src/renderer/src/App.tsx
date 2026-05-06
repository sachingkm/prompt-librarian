function App(): JSX.Element {
  return (
    <div className="shell">
      <header className="title-bar">
        <span className="brand">Prompt Librarian</span>
        <span className="phase-tag">Phase 0 - scaffolding</span>
      </header>

      <main className="main">
        <div className="empty-state">
          <h1>Prompt Librarian</h1>
          <p className="lead">
            Local-first desktop app for capturing, classifying, and reusing prompts as Markdown
            files.
          </p>
          <p className="dim">
            The shell is up. Filesystem access, onboarding, classification, and library browsing
            are still to come in later phases.
          </p>
        </div>
      </main>

      <footer className="status-bar">
        <span>electron-vite + react + typescript</span>
        <span className="dim">no library selected yet</span>
      </footer>
    </div>
  )
}

export default App
