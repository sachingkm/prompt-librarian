import { useEffect, useState } from 'react'
import type { Prompt, SaveResult, MoveResult, InitResult } from '../../shared/ipc'

type LogEntry = { ts: string; kind: 'info' | 'ok' | 'warn' | 'err'; text: string }

function nowIso(): string {
  return new Date().toISOString()
}

function formatJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export default function Phase1TestPanel(): JSX.Element {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [scan, setScan] = useState<Prompt[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [filename, setFilename] = useState('phase1-test.md')
  const [folder, setFolder] = useState('05-Research')

  function append(kind: LogEntry['kind'], text: string): void {
    setLog((prev) => [{ ts: nowIso().slice(11, 19), kind, text }, ...prev].slice(0, 200))
  }

  useEffect(() => {
    void (async () => {
      try {
        const p = await window.api.getRootPath()
        setRootPath(p)
        if (p) append('info', `Loaded saved root path: ${p}`)
        else append('info', 'No root path saved yet.')
      } catch (err) {
        append('err', `getRootPath failed: ${(err as Error).message}`)
      }
    })()
  }, [])

  async function doChooseFolder(): Promise<void> {
    setBusy(true)
    try {
      const picked = await window.api.chooseFolder(rootPath ?? undefined)
      if (!picked) {
        append('warn', 'Folder picker cancelled')
        return
      }
      await window.api.setRootPath(picked)
      setRootPath(picked)
      append('ok', `Root path set to: ${picked}`)
    } catch (err) {
      append('err', `chooseFolder failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function doInit(): Promise<void> {
    if (!rootPath) {
      append('warn', 'Pick a root path first.')
      return
    }
    setBusy(true)
    try {
      const result: InitResult = await window.api.initLibrary(rootPath)
      append(result.ok ? 'ok' : 'err', `initLibrary: ${formatJson(result)}`)
    } catch (err) {
      append('err', `initLibrary failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function doScan(): Promise<void> {
    setBusy(true)
    try {
      const items = await window.api.scanLibrary()
      setScan(items)
      append('ok', `scanLibrary returned ${items.length} prompt(s)`)
    } catch (err) {
      append('err', `scanLibrary failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function doSave(strategy: 'fail' | 'overwrite' | 'rename'): Promise<void> {
    setBusy(true)
    try {
      const draft = {
        folder,
        filename,
        frontmatter: {
          title: 'Phase 1 test prompt',
          category: 'Research',
          subcategory: 'Smoke test',
          tags: ['phase-1', 'ipc'],
          reuse: 'low' as const,
          scope: 'one-off' as const,
          created_at: nowIso(),
          updated_at: nowIso()
        },
        body: '## Purpose\n\nVerify the IPC save flow.\n\n## Prompt\n\nThis is a Phase 1 smoke test.\n'
      }
      const opts =
        strategy === 'rename'
          ? { strategy, newFilename: filename.replace(/\.md$/i, '') + '-copy.md' }
          : { strategy }
      const result: SaveResult = await window.api.savePrompt(draft, opts)
      append(result.ok ? 'ok' : 'warn', `savePrompt(${strategy}): ${formatJson(result)}`)
    } catch (err) {
      append('err', `savePrompt failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function doArchive(relPath: string): Promise<void> {
    setBusy(true)
    try {
      const result: MoveResult = await window.api.archivePrompt(relPath)
      append(result.ok ? 'ok' : 'err', `archivePrompt(${relPath}): ${formatJson(result)}`)
    } catch (err) {
      append('err', `archivePrompt failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function doMove(relPath: string, newFolder: string): Promise<void> {
    setBusy(true)
    try {
      const result = await window.api.movePrompt(relPath, newFolder)
      append(result.ok ? 'ok' : 'err', `movePrompt(${relPath} -> ${newFolder}): ${formatJson(result)}`)
    } catch (err) {
      append('err', `movePrompt failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="phase1-panel">
      <header className="phase1-head">
        <strong>Phase 1 test surface</strong>
        <span className="dim"> - exercises filesystem IPC. Not the final UI.</span>
      </header>

      <section className="phase1-row">
        <div className="phase1-cell">
          <div className="phase1-label">Library root</div>
          <div className="phase1-value">{rootPath ?? '(none)'}</div>
        </div>
        <div className="phase1-actions">
          <button onClick={doChooseFolder} disabled={busy}>
            Choose folder
          </button>
          <button onClick={doInit} disabled={busy || !rootPath}>
            Initialize default structure
          </button>
          <button onClick={doScan} disabled={busy || !rootPath}>
            Scan library
          </button>
        </div>
      </section>

      <section className="phase1-row">
        <div className="phase1-cell">
          <label className="phase1-label" htmlFor="phase1-folder">Folder</label>
          <input
            id="phase1-folder"
            type="text"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
        </div>
        <div className="phase1-cell">
          <label className="phase1-label" htmlFor="phase1-filename">Filename</label>
          <input
            id="phase1-filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </div>
        <div className="phase1-actions">
          <button onClick={() => doSave('fail')} disabled={busy || !rootPath}>
            Save (fail on collision)
          </button>
          <button onClick={() => doSave('overwrite')} disabled={busy || !rootPath}>
            Save (overwrite)
          </button>
          <button onClick={() => doSave('rename')} disabled={busy || !rootPath}>
            Save (rename copy)
          </button>
        </div>
      </section>

      <section className="phase1-grid">
        <div className="phase1-list">
          <div className="phase1-label">Scan results ({scan.length})</div>
          {scan.length === 0 ? (
            <div className="dim">No prompts scanned yet.</div>
          ) : (
            <ul>
              {scan.map((p) => (
                <li key={p.relPath}>
                  <code>{p.relPath}</code>
                  <span className="dim"> - {p.frontmatter.title}</span>
                  <button
                    className="mini"
                    onClick={() => doArchive(p.relPath)}
                    disabled={busy}
                  >
                    archive
                  </button>
                  <button
                    className="mini"
                    onClick={() => doMove(p.relPath, folder)}
                    disabled={busy}
                  >
                    move to "{folder}"
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="phase1-log">
          <div className="phase1-label">Log</div>
          <ul>
            {log.map((entry, i) => (
              <li key={i} className={`log-${entry.kind}`}>
                <span className="ts">{entry.ts}</span>
                <pre>{entry.text}</pre>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
