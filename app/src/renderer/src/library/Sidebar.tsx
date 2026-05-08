import type { BrowserTotals, FolderNode, View } from './types'

interface Props {
  view: View
  totals: BrowserTotals
  folderTree: FolderNode[]
  onView: (v: View) => void
  onRefresh: () => void
  refreshing: boolean
}

interface FolderRowProps {
  node: FolderNode
  view: View
  onView: (v: View) => void
  depth: number
}

function FolderRow({ node, view, onView, depth }: FolderRowProps): JSX.Element {
  const selected = view.kind === 'folder' && view.folder === node.path
  return (
    <>
      <li>
        <button
          type="button"
          className={`sidebar-folder ${selected ? 'selected' : ''}`}
          onClick={() => onView({ kind: 'folder', folder: node.path })}
          style={{ paddingLeft: 8 + depth * 14 }}
          title={node.path}
        >
          <span className="sidebar-folder-name">{node.name}</span>
          <span className="dim">{node.count}</span>
        </button>
      </li>
      {node.children.map((c) => (
        <FolderRow key={c.path} node={c} view={view} onView={onView} depth={depth + 1} />
      ))}
    </>
  )
}

export default function Sidebar({
  view,
  totals,
  folderTree,
  onView,
  onRefresh,
  refreshing
}: Props): JSX.Element {
  const navItems: Array<{ kind: View['kind']; label: string; count: number | null }> = [
    { kind: 'home', label: 'Home', count: null },
    { kind: 'all', label: 'All prompts', count: totals.all },
    { kind: 'recent', label: 'Recent', count: totals.recent },
    { kind: 'archive', label: 'Archive', count: totals.archive },
    { kind: 'hygiene', label: 'Needs metadata', count: totals.hygiene }
  ]

  return (
    <aside className="library-sidebar">
      <nav>
        <ul className="sidebar-nav">
          {navItems.map((n) => (
            <li key={n.kind}>
              <button
                type="button"
                className={`sidebar-nav-btn ${view.kind === n.kind ? 'selected' : ''}`}
                onClick={() => {
                  if (n.kind === 'folder') return // folder nav uses tree below
                  onView({ kind: n.kind } as View)
                }}
              >
                <span>{n.label}</span>
                {n.count !== null && <span className="dim">{n.count}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-folders">
        <h3 className="sidebar-section-title">Folders</h3>
        {folderTree.length === 0 ? (
          <p className="dim sidebar-empty">No folders yet.</p>
        ) : (
          <ul className="sidebar-folder-list">
            {folderTree.map((n) => (
              <FolderRow key={n.path} node={n} view={view} onView={onView} depth={0} />
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="sidebar-refresh onboarding-secondary"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing...' : 'Refresh from disk'}
      </button>
    </aside>
  )
}
