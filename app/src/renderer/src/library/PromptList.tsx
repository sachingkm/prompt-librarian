import type { Prompt } from '../../../shared/ipc'
import { displayTitle, formatDate, toWindowsDisplay } from './utils'

interface Props {
  prompts: Prompt[]
  selectedRelPath: string | null
  onSelect: (relPath: string) => void
  emptyMessage: string
}

export default function PromptList({
  prompts,
  selectedRelPath,
  onSelect,
  emptyMessage
}: Props): JSX.Element {
  if (prompts.length === 0) {
    return (
      <div className="library-empty">
        <p className="dim">{emptyMessage}</p>
      </div>
    )
  }
  return (
    <ul className="prompt-list">
      {prompts.map((p) => (
        <li
          key={p.relPath}
          className={`prompt-list-item ${selectedRelPath === p.relPath ? 'selected' : ''}`}
          onClick={() => onSelect(p.relPath)}
        >
          <div className="prompt-list-title">{displayTitle(p)}</div>
          <div className="prompt-list-meta">
            <span className="dim" title={p.relPath}>
              {toWindowsDisplay(p.folder)}
            </span>
            {p.frontmatter.category && (
              <span className="prompt-pill">
                {p.frontmatter.category}
                {p.frontmatter.subcategory ? ` / ${p.frontmatter.subcategory}` : ''}
              </span>
            )}
            {p.frontmatter.tags && p.frontmatter.tags.length > 0 && (
              <span className="dim">{p.frontmatter.tags.slice(0, 3).join(', ')}</span>
            )}
            <span className="dim">{formatDate(p.frontmatter.updated_at)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
