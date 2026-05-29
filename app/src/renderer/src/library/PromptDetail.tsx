import { useEffect, useState } from 'react'
import type {
  Prompt,
  PromptDraft,
  PromptFrontmatter,
  ReuseLevel,
  Scope
} from '../../../shared/ipc'
import { displayTitle, formatDate, toWindowsDisplay } from './utils'

interface Props {
  prompt: Prompt | null
  // Called with the (possibly new) relPath after a successful edit so the
  // browser can rescan and reselect the prompt.
  onSaved?: (newRelPath: string) => void
}

interface EditState {
  title: string
  category: string
  subcategory: string
  tags: string
  reuse: ReuseLevel
  scope: Scope
  folder: string
  filename: string
  body: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function toEditState(p: Prompt): EditState {
  const fm = p.frontmatter
  return {
    title: fm.title ?? '',
    category: fm.category ?? '',
    subcategory: fm.subcategory ?? '',
    tags: (fm.tags ?? []).join(', '),
    reuse: (fm.reuse as ReuseLevel) ?? 'medium',
    scope: (fm.scope as Scope) ?? 'reusable',
    folder: p.folder === '.' ? '' : p.folder,
    filename: p.filename,
    body: p.body ?? ''
  }
}

export default function PromptDetail({ prompt, onSaved }: Props): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditState | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [collision, setCollision] = useState<string | null>(null)
  // Collapse the metadata fields to give the body near-full-window height.
  const [metaCollapsed, setMetaCollapsed] = useState(false)

  // Reset edit mode whenever the selected prompt changes.
  useEffect(() => {
    setEditing(false)
    setForm(null)
    setSaveError(null)
    setCollision(null)
  }, [prompt?.relPath])

  // Lazily load folder + category suggestions when entering edit mode.
  useEffect(() => {
    if (!editing) return
    void (async () => {
      try {
        const [folderList, rules] = await Promise.all([
          window.api.listFolders().catch(() => [] as string[]),
          window.api.getRules().catch(() => null)
        ])
        setFolders(folderList)
        setCategories(
          rules ? rules.rules.categories.filter((c) => c.enabled !== false).map((c) => c.label) : []
        )
      } catch {
        // suggestions are optional
      }
    })()
  }, [editing])

  if (!prompt) {
    return (
      <aside className="library-detail">
        <div className="library-empty">
          <p className="dim">Select a prompt to see details.</p>
        </div>
      </aside>
    )
  }

  function startEdit(): void {
    if (!prompt) return
    setForm(toEditState(prompt))
    setSaveError(null)
    setCollision(null)
    setEditing(true)
  }

  function cancelEdit(): void {
    setEditing(false)
    setForm(null)
    setSaveError(null)
    setCollision(null)
  }

  function patch<K extends keyof EditState>(key: K, value: EditState[K]): void {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function doSave(strategy: 'fail' | 'overwrite'): Promise<void> {
    if (!prompt || !form) return
    setSaveBusy(true)
    setSaveError(null)
    try {
      // Preserve any unknown frontmatter keys; override the known ones and
      // bump updated_at while keeping the original created_at.
      const frontmatter: PromptFrontmatter = {
        ...prompt.frontmatter,
        title: form.title,
        category: form.category || undefined,
        subcategory: form.subcategory || undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0),
        reuse: form.reuse,
        scope: form.scope,
        created_at: prompt.frontmatter.created_at,
        updated_at: nowIso()
      }
      const draft: PromptDraft = {
        folder: form.folder,
        filename: form.filename,
        frontmatter,
        body: form.body
      }
      const result = await window.api.updatePrompt(prompt.relPath, draft, { strategy })
      if (result.ok) {
        setEditing(false)
        setForm(null)
        setCollision(null)
        if (onSaved && result.relPath) onSaved(result.relPath)
        return
      }
      if (result.collision) {
        setCollision(result.relPath ?? draft.filename)
        return
      }
      setSaveError(result.error ?? 'Save failed.')
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaveBusy(false)
    }
  }

  const fm = prompt.frontmatter

  if (editing && form) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit prompt">
        <div className="modal-panel prompt-edit-panel">
          <header className="modal-head">
            <div>
              <h2>Edit prompt</h2>
              <code className="detail-path">{toWindowsDisplay(prompt.relPath)}</code>
            </div>
            <button className="onboarding-secondary" onClick={cancelEdit} disabled={saveBusy}>
              Cancel
            </button>
          </header>

          <div className="prompt-edit-body">
            <section className="modal-section">
              <div className="prompt-edit-meta-head">
                <span className="phase1-label">Metadata</span>
                <button
                  type="button"
                  className="onboarding-secondary"
                  onClick={() => setMetaCollapsed((v) => !v)}
                >
                  {metaCollapsed ? 'Show fields' : 'Hide fields'}
                </button>
              </div>
              <div className="form-grid" hidden={metaCollapsed}>
            <label>Title</label>
            <input type="text" value={form.title} onChange={(e) => patch('title', e.target.value)} />

            <label>Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => patch('category', e.target.value)}
              list="detail-category-list"
            />
            <datalist id="detail-category-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <label>Subcategory</label>
            <input
              type="text"
              value={form.subcategory}
              onChange={(e) => patch('subcategory', e.target.value)}
            />

            <label>Tags</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => patch('tags', e.target.value)}
              placeholder="comma, separated, lowercase"
            />

            <label>Reuse</label>
            <select value={form.reuse} onChange={(e) => patch('reuse', e.target.value as ReuseLevel)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>

            <label>Scope</label>
            <select value={form.scope} onChange={(e) => patch('scope', e.target.value as Scope)}>
              <option value="reusable">reusable</option>
              <option value="one-off">one-off</option>
            </select>

            <label>Folder</label>
            <input
              type="text"
              value={form.folder}
              onChange={(e) => patch('folder', e.target.value)}
              list="detail-folder-list"
              placeholder="Type a new path to move/create on save"
            />
            <datalist id="detail-folder-list">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>

            <label>Filename</label>
            <input
              type="text"
              value={form.filename}
              onChange={(e) => patch('filename', e.target.value)}
            />
          </div>
        </section>

            <section className="modal-section prompt-edit-body-section">
              <div className="phase1-label">Body</div>
              <textarea
                className={
                  metaCollapsed ? 'prompt-edit-textarea prompt-edit-textarea--max' : 'prompt-edit-textarea'
                }
                value={form.body}
                onChange={(e) => patch('body', e.target.value)}
              />
            </section>

            {saveError && (
              <section className="modal-section">
                <div className="onboarding-error">{saveError}</div>
              </section>
            )}

            {collision && (
              <section className="modal-section">
                <div className="onboarding-info">
                  A different prompt already exists at <code>{collision}</code>. Change the folder
                  or filename, or overwrite it.
                </div>
                <div className="modal-actions">
                  <button
                    className="onboarding-secondary"
                    onClick={() => void doSave('overwrite')}
                    disabled={saveBusy}
                  >
                    Overwrite existing
                  </button>
                  <button
                    className="onboarding-secondary"
                    onClick={() => setCollision(null)}
                    disabled={saveBusy}
                  >
                    Back to edit
                  </button>
                </div>
              </section>
            )}
          </div>

          <footer className="modal-section prompt-edit-footer">
            <div className="modal-actions">
              <button className="onboarding-secondary" onClick={cancelEdit} disabled={saveBusy}>
                Cancel
              </button>
              {!collision && (
                <button
                  className="onboarding-primary"
                  onClick={() => void doSave('fail')}
                  disabled={
                    saveBusy || form.title.trim().length === 0 || form.filename.trim().length === 0
                  }
                >
                  {saveBusy ? 'Saving...' : 'Save changes'}
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <aside className="library-detail">
      <header className="detail-head">
        <div className="detail-head-row">
          <h2 className="detail-title">{displayTitle(prompt)}</h2>
          <button type="button" className="onboarding-secondary" onClick={startEdit}>
            Edit
          </button>
        </div>
        <code className="detail-path">{toWindowsDisplay(prompt.relPath)}</code>
      </header>

      <section className="detail-section">
        <div className="phase1-label">Frontmatter</div>
        <dl className="detail-fm">
          <dt>Category</dt>
          <dd>{fm.category || '-'}</dd>
          <dt>Subcategory</dt>
          <dd>{fm.subcategory || '-'}</dd>
          <dt>Tags</dt>
          <dd>{fm.tags && fm.tags.length > 0 ? fm.tags.join(', ') : '-'}</dd>
          <dt>Reuse</dt>
          <dd>{fm.reuse || '-'}</dd>
          <dt>Scope</dt>
          <dd>{fm.scope || '-'}</dd>
          <dt>Created</dt>
          <dd>{formatDate(fm.created_at)}</dd>
          <dt>Updated</dt>
          <dd>{formatDate(fm.updated_at)}</dd>
        </dl>
      </section>

      <section className="detail-section">
        <div className="phase1-label">Body</div>
        <pre className="detail-body">{prompt.body || '(empty)'}</pre>
      </section>
    </aside>
  )
}
