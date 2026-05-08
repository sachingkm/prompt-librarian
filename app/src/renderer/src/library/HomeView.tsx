import type { Prompt } from '../../../shared/ipc'
import { displayTitle, isArchive, isHygiene, recentSort } from './utils'

interface Props {
  prompts: Prompt[]
  onOpen: (relPath: string) => void
  onView: (kind: 'all' | 'recent' | 'archive' | 'hygiene') => void
}

export default function HomeView({ prompts, onOpen, onView }: Props): JSX.Element {
  if (prompts.length === 0) {
    return (
      <div className="library-empty">
        <h2>Your library is empty</h2>
        <p className="dim">
          Phase 4 will let you paste and classify prompts. For now, drop Markdown files
          in your library root and click Refresh.
        </p>
      </div>
    )
  }

  const total = prompts.length
  const byCategory = new Map<string, number>()
  for (const p of prompts) {
    const cat = p.frontmatter.category || '(uncategorized)'
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1)
  }
  const recent = [...prompts].sort(recentSort).slice(0, 5)
  const archiveCount = prompts.filter(isArchive).length
  const hygieneCount = prompts.filter(isHygiene).length

  return (
    <div className="library-home">
      <header>
        <h1>Library home</h1>
        <p className="dim">
          {total} prompt{total === 1 ? '' : 's'} in your library
        </p>
      </header>

      <section className="home-cards">
        <button type="button" className="home-card" onClick={() => onView('all')}>
          <div className="home-card-num">{total}</div>
          <div className="home-card-label">Total prompts</div>
        </button>
        <button type="button" className="home-card" onClick={() => onView('recent')}>
          <div className="home-card-num">{Math.min(5, total)}</div>
          <div className="home-card-label">Most recent</div>
        </button>
        <button type="button" className="home-card" onClick={() => onView('archive')}>
          <div className="home-card-num">{archiveCount}</div>
          <div className="home-card-label">Archived</div>
        </button>
        <button type="button" className="home-card" onClick={() => onView('hygiene')}>
          <div className="home-card-num">{hygieneCount}</div>
          <div className="home-card-label">Need metadata</div>
        </button>
      </section>

      <section className="home-section">
        <h2>By category</h2>
        <ul className="home-list">
          {[...byCategory.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([cat, n]) => (
              <li key={cat}>
                <span className="home-list-label">{cat}</span>
                <span className="dim">{n}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="home-section">
        <h2>Recently updated</h2>
        <ul className="home-list">
          {recent.map((p) => (
            <li key={p.relPath}>
              <button
                type="button"
                className="home-list-link"
                onClick={() => onOpen(p.relPath)}
              >
                {displayTitle(p)}
              </button>
              <span className="dim">{p.folder}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
