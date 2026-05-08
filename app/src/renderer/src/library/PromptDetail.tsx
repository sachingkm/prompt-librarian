import type { Prompt } from '../../../shared/ipc'
import { displayTitle, formatDate, toWindowsDisplay } from './utils'

interface Props {
  prompt: Prompt | null
}

export default function PromptDetail({ prompt }: Props): JSX.Element {
  if (!prompt) {
    return (
      <aside className="library-detail">
        <div className="library-empty">
          <p className="dim">Select a prompt to see details.</p>
        </div>
      </aside>
    )
  }

  const fm = prompt.frontmatter

  return (
    <aside className="library-detail">
      <header className="detail-head">
        <h2 className="detail-title">{displayTitle(prompt)}</h2>
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
