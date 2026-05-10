// Left-side tree view for the rules editor. Renders categories with their
// subcategories, then projects, then fallback / scoring / reuse / pending
// proposals as virtual nodes. Read-only: selection is the only output.

import type { ClassifierRules } from '../../../shared/classifierRules'
import type { RuleSelection } from './selection'
import type { RulesDiff } from './diff'

interface Props {
  rules: ClassifierRules
  selection: RuleSelection | null
  diff: RulesDiff
  pendingProposalCount: number
  onSelect: (s: RuleSelection) => void
  onAddCategory: () => void
  onAddProject: () => void
  onAddSubcategory: (categoryId: string) => void
}

function ModBadge({ on }: { on: boolean }): JSX.Element | null {
  if (!on) return null
  return <span className="rules-mod-badge" title="Modified from defaults">M</span>
}

export default function RulesTreeView({
  rules,
  selection,
  diff,
  pendingProposalCount,
  onSelect,
  onAddCategory,
  onAddProject,
  onAddSubcategory
}: Props): JSX.Element {
  function isSelected(s: RuleSelection): boolean {
    if (!selection) return false
    if (selection.kind !== s.kind) return false
    if (s.kind === 'category' && selection.kind === 'category') {
      return s.categoryId === selection.categoryId
    }
    if (s.kind === 'subcategory' && selection.kind === 'subcategory') {
      return s.categoryId === selection.categoryId && s.subId === selection.subId
    }
    if (s.kind === 'project' && selection.kind === 'project') {
      return s.projectId === selection.projectId
    }
    return true
  }

  function rowClass(s: RuleSelection, depth = 0): string {
    return [
      'rules-tree-row',
      depth > 0 ? 'rules-tree-indent' : '',
      isSelected(s) ? 'rules-tree-selected' : ''
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <nav className="rules-tree" aria-label="Rules tree">
      <div className="rules-tree-section">
        <div className="rules-tree-header">
          <span>Categories</span>
          <button
            type="button"
            className="rules-tree-add"
            onClick={onAddCategory}
            aria-label="Add category"
          >
            +
          </button>
        </div>
        {rules.categories.length === 0 && (
          <div className="rules-tree-empty">No categories. Add one to get started.</div>
        )}
        {rules.categories.map((c) => {
          const sel: RuleSelection = { kind: 'category', categoryId: c.id }
          return (
            <div key={c.id}>
              <button
                type="button"
                className={rowClass(sel)}
                onClick={() => onSelect(sel)}
              >
                <span className="rules-tree-label">
                  {c.label}
                  {c.enabled === false && <span className="dim"> (off)</span>}
                </span>
                <ModBadge on={diff.modifiedCategories.has(c.id)} />
              </button>
              {(c.subcategories ?? []).map((s) => {
                const sub: RuleSelection = {
                  kind: 'subcategory',
                  categoryId: c.id,
                  subId: s.id
                }
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={rowClass(sub, 1)}
                    onClick={() => onSelect(sub)}
                  >
                    <span className="rules-tree-label">
                      {s.label}
                      {s.enabled === false && <span className="dim"> (off)</span>}
                    </span>
                    <ModBadge on={diff.modifiedSubcategories.has(s.id)} />
                  </button>
                )
              })}
              <button
                type="button"
                className="rules-tree-add-sub"
                onClick={() => onAddSubcategory(c.id)}
              >
                + add subcategory
              </button>
            </div>
          )
        })}
      </div>

      <div className="rules-tree-section">
        <div className="rules-tree-header">
          <span>Projects</span>
          <button
            type="button"
            className="rules-tree-add"
            onClick={onAddProject}
            aria-label="Add project"
          >
            +
          </button>
        </div>
        {rules.projects.length === 0 && (
          <div className="rules-tree-empty">No projects. Triggers act as exact-phrase overrides.</div>
        )}
        {rules.projects.map((p) => {
          const sel: RuleSelection = { kind: 'project', projectId: p.id }
          return (
            <button
              key={p.id}
              type="button"
              className={rowClass(sel)}
              onClick={() => onSelect(sel)}
            >
              <span className="rules-tree-label">
                {p.label}
                {p.enabled === false && <span className="dim"> (off)</span>}
              </span>
              <ModBadge on={diff.modifiedProjects.has(p.id)} />
            </button>
          )
        })}
      </div>

      <div className="rules-tree-section">
        <div className="rules-tree-header">
          <span>Settings</span>
        </div>
        <button
          type="button"
          className={rowClass({ kind: 'fallback' })}
          onClick={() => onSelect({ kind: 'fallback' })}
        >
          <span className="rules-tree-label">Fallback</span>
          <ModBadge on={diff.fallbackChanged} />
        </button>
        <button
          type="button"
          className={rowClass({ kind: 'scoring' })}
          onClick={() => onSelect({ kind: 'scoring' })}
        >
          <span className="rules-tree-label">Confidence tiers</span>
          <ModBadge on={diff.scoringChanged} />
        </button>
        <button
          type="button"
          className={rowClass({ kind: 'reuse' })}
          onClick={() => onSelect({ kind: 'reuse' })}
        >
          <span className="rules-tree-label">Reuse defaults</span>
          <ModBadge on={diff.reuseDefaultsChanged} />
        </button>
        <button
          type="button"
          className={rowClass({ kind: 'proposals' })}
          onClick={() => onSelect({ kind: 'proposals' })}
        >
          <span className="rules-tree-label">
            Pending proposals
            {pendingProposalCount > 0 && (
              <span className="rules-pending-badge">{pendingProposalCount}</span>
            )}
          </span>
        </button>
      </div>
    </nav>
  )
}
