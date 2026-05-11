// Right-pane editor. Switches on `selection.kind` and renders the
// appropriate form. All edits go through onChange callbacks that produce
// a NEW ClassifierRules tree (immutable update). Validation errors
// scoped to the selected node are listed inline.

import type {
  ClassifierRuleCategory,
  ClassifierRuleKeyword,
  ClassifierRuleProject,
  ClassifierRuleSubcategory,
  ClassifierRules,
  ClassifierRulesIssue
} from '../../../shared/classifierRules'
import type { RuleSelection } from './selection'

interface Props {
  rules: ClassifierRules
  selection: RuleSelection | null
  errors: ClassifierRulesIssue[]
  warnings: ClassifierRulesIssue[]
  onChange: (next: ClassifierRules) => void
  onDeleteSelection: () => void
}

function findCategoryIndex(rules: ClassifierRules, id: string): number {
  return rules.categories.findIndex((c) => c.id === id)
}

function findProjectIndex(rules: ClassifierRules, id: string): number {
  return rules.projects.findIndex((p) => p.id === id)
}

function replaceCategory(
  rules: ClassifierRules,
  id: string,
  next: ClassifierRuleCategory
): ClassifierRules {
  const i = findCategoryIndex(rules, id)
  if (i < 0) return rules
  const copy = rules.categories.slice()
  copy[i] = next
  return { ...rules, categories: copy }
}

function replaceSubcategory(
  rules: ClassifierRules,
  catId: string,
  subId: string,
  next: ClassifierRuleSubcategory
): ClassifierRules {
  const ci = findCategoryIndex(rules, catId)
  if (ci < 0) return rules
  const cat = rules.categories[ci]
  const subs = (cat.subcategories ?? []).slice()
  const si = subs.findIndex((s) => s.id === subId)
  if (si < 0) return rules
  subs[si] = next
  const copyCats = rules.categories.slice()
  copyCats[ci] = { ...cat, subcategories: subs }
  return { ...rules, categories: copyCats }
}

function replaceProject(
  rules: ClassifierRules,
  id: string,
  next: ClassifierRuleProject
): ClassifierRules {
  const i = findProjectIndex(rules, id)
  if (i < 0) return rules
  const copy = rules.projects.slice()
  copy[i] = next
  return { ...rules, projects: copy }
}

function ErrorList({
  issues,
  pathPrefix
}: {
  issues: ClassifierRulesIssue[]
  pathPrefix: string
}): JSX.Element | null {
  const filtered = issues.filter((i) => i.path === pathPrefix || i.path.startsWith(`${pathPrefix}/`))
  if (filtered.length === 0) return null
  return (
    <ul className="onboarding-errors">
      {filtered.map((e, i) => (
        <li key={i}>
          <code>{e.path || '/'}</code>: {e.message}
        </li>
      ))}
    </ul>
  )
}

function WarningList({
  warnings,
  pathPrefix
}: {
  warnings: ClassifierRulesIssue[]
  pathPrefix: string
}): JSX.Element | null {
  const filtered = warnings.filter(
    (i) => i.path === pathPrefix || i.path.startsWith(`${pathPrefix}/`)
  )
  if (filtered.length === 0) return null
  return (
    <div className="onboarding-info">
      {filtered.map((w, i) => (
        <div key={i}>{w.message}</div>
      ))}
    </div>
  )
}

function KeywordsTable({
  keywords,
  errors,
  pathPrefix,
  onChange
}: {
  keywords: ClassifierRuleKeyword[]
  errors: ClassifierRulesIssue[]
  pathPrefix: string
  onChange: (next: ClassifierRuleKeyword[]) => void
}): JSX.Element {
  function update(i: number, patch: Partial<ClassifierRuleKeyword>): void {
    const next = keywords.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  function remove(i: number): void {
    const next = keywords.slice()
    next.splice(i, 1)
    onChange(next)
  }
  function add(): void {
    onChange([...keywords, { term: '', weight: 1 }])
  }
  return (
    <div className="rules-keywords">
      <table className="rules-keywords-table">
        <thead>
          <tr>
            <th>Term</th>
            <th>Weight</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {keywords.length === 0 && (
            <tr>
              <td colSpan={3} className="dim">
                No keywords. Add some to score this rule.
              </td>
            </tr>
          )}
          {keywords.map((kw, i) => (
            <tr key={i}>
              <td>
                <input
                  type="text"
                  value={kw.term}
                  onChange={(e) => update(i, { term: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="1"
                  value={kw.weight}
                  onChange={(e) => update(i, { weight: Number(e.target.value) })}
                  className="rules-weight-input"
                />
              </td>
              <td>
                <button
                  type="button"
                  className="onboarding-secondary rules-keyword-remove"
                  onClick={() => remove(i)}
                  aria-label="Remove keyword"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="modal-actions">
        <button type="button" className="onboarding-secondary" onClick={add}>
          + Add keyword
        </button>
      </div>
      <ErrorList issues={errors} pathPrefix={pathPrefix} />
    </div>
  )
}

function StringListInput({
  value,
  placeholder,
  onChange
}: {
  value: string[]
  placeholder?: string
  onChange: (next: string[]) => void
}): JSX.Element {
  const text = value.join(', ')
  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        )
      }
    />
  )
}

export default function RuleDetail({
  rules,
  selection,
  errors,
  warnings,
  onChange,
  onDeleteSelection
}: Props): JSX.Element {
  if (!selection) {
    return (
      <div className="rules-detail rules-detail-empty">
        Select a rule from the tree to edit it.
      </div>
    )
  }

  if (selection.kind === 'proposals') {
    // The shell renders the proposals panel itself.
    return <></>
  }

  if (selection.kind === 'fallback') {
    return (
      <div className="rules-detail">
        <h3>Fallback</h3>
        <p className="dim">
          Used when no other rule matches strongly. The fallback is always present and
          cannot be deleted.
        </p>
        <div className="form-grid">
          <label>Label</label>
          <input
            type="text"
            value={rules.fallback.label}
            onChange={(e) =>
              onChange({ ...rules, fallback: { ...rules.fallback, label: e.target.value } })
            }
          />
          <label>Folder</label>
          <input
            type="text"
            value={rules.fallback.folder}
            onChange={(e) =>
              onChange({ ...rules, fallback: { ...rules.fallback, folder: e.target.value } })
            }
          />
        </div>
        <ErrorList issues={errors} pathPrefix="/fallback" />
        <WarningList warnings={warnings} pathPrefix="/fallback" />
      </div>
    )
  }

  if (selection.kind === 'scoring') {
    return (
      <div className="rules-detail">
        <h3>Confidence tiers</h3>
        <p className="dim">
          Thresholds applied to the normalized 0..1 score. Scores at or above highTier are
          flagged "high"; at or above mediumTier are "medium"; otherwise "low".
        </p>
        <div className="form-grid">
          <label>High tier</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={rules.scoring.highTier}
            onChange={(e) =>
              onChange({
                ...rules,
                scoring: { ...rules.scoring, highTier: Number(e.target.value) }
              })
            }
          />
          <label>Medium tier</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={rules.scoring.mediumTier}
            onChange={(e) =>
              onChange({
                ...rules,
                scoring: { ...rules.scoring, mediumTier: Number(e.target.value) }
              })
            }
          />
        </div>
        <ErrorList issues={errors} pathPrefix="/scoring" />
      </div>
    )
  }

  if (selection.kind === 'reuse') {
    return (
      <div className="rules-detail">
        <h3>Reuse defaults</h3>
        <p className="dim">
          Phrases that bias the inferred reuse level. "high" wins over "low" when both match.
        </p>
        <div className="form-grid">
          <label>High phrases</label>
          <StringListInput
            value={rules.reuseDefaults.highPhrases}
            placeholder="comma, separated"
            onChange={(next) =>
              onChange({
                ...rules,
                reuseDefaults: { ...rules.reuseDefaults, highPhrases: next }
              })
            }
          />
          <label>Low phrases</label>
          <StringListInput
            value={rules.reuseDefaults.lowPhrases}
            placeholder="comma, separated"
            onChange={(next) =>
              onChange({
                ...rules,
                reuseDefaults: { ...rules.reuseDefaults, lowPhrases: next }
              })
            }
          />
        </div>
        <ErrorList issues={errors} pathPrefix="/reuseDefaults" />
      </div>
    )
  }

  if (selection.kind === 'category') {
    const ci = findCategoryIndex(rules, selection.categoryId)
    if (ci < 0) {
      return <div className="rules-detail rules-detail-empty">Category no longer exists.</div>
    }
    const cat = rules.categories[ci]
    const path = `/categories/${ci}`
    function patch(p: Partial<ClassifierRuleCategory>): void {
      onChange(replaceCategory(rules, cat.id, { ...cat, ...p }))
    }
    return (
      <div className="rules-detail">
        <div className="rules-detail-head">
          <h3>Category: {cat.label || '(unnamed)'}</h3>
          <button
            type="button"
            className="onboarding-secondary"
            onClick={onDeleteSelection}
          >
            Delete category
          </button>
        </div>
        <div className="form-grid">
          <label>ID</label>
          <input
            type="text"
            value={cat.id}
            readOnly
            title="Internal rule ID. Rename the label instead."
          />
          <label>Label</label>
          <input
            type="text"
            value={cat.label}
            onChange={(e) => patch({ label: e.target.value })}
          />
          <label>Folder</label>
          <input
            type="text"
            value={cat.folder}
            onChange={(e) => patch({ folder: e.target.value })}
          />
          <label>Priority</label>
          <input
            type="number"
            step="1"
            value={cat.priority ?? 0}
            onChange={(e) => patch({ priority: Number(e.target.value) })}
          />
          <label>Enabled</label>
          <input
            type="checkbox"
            checked={cat.enabled !== false}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <label>Tags</label>
          <StringListInput
            value={cat.tags ?? []}
            placeholder="comma, separated"
            onChange={(next) => patch({ tags: next })}
          />
          <label>Negative keywords</label>
          <StringListInput
            value={cat.negativeKeywords ?? []}
            placeholder="comma, separated"
            onChange={(next) => patch({ negativeKeywords: next })}
          />
        </div>
        <h4>Keywords</h4>
        <KeywordsTable
          keywords={cat.keywords ?? []}
          errors={errors}
          pathPrefix={`${path}/keywords`}
          onChange={(next) => patch({ keywords: next })}
        />
        <ErrorList issues={errors} pathPrefix={path} />
        <WarningList warnings={warnings} pathPrefix={path} />
      </div>
    )
  }

  if (selection.kind === 'subcategory') {
    const ci = findCategoryIndex(rules, selection.categoryId)
    if (ci < 0) {
      return <div className="rules-detail rules-detail-empty">Parent category gone.</div>
    }
    const cat = rules.categories[ci]
    const subs = cat.subcategories ?? []
    const si = subs.findIndex((s) => s.id === selection.subId)
    if (si < 0) {
      return <div className="rules-detail rules-detail-empty">Subcategory no longer exists.</div>
    }
    const sub = subs[si]
    const path = `/categories/${ci}/subcategories/${si}`
    function patch(p: Partial<ClassifierRuleSubcategory>): void {
      onChange(replaceSubcategory(rules, cat.id, sub.id, { ...sub, ...p }))
    }
    return (
      <div className="rules-detail">
        <div className="rules-detail-head">
          <h3>Subcategory: {sub.label || '(unnamed)'}</h3>
          <button
            type="button"
            className="onboarding-secondary"
            onClick={onDeleteSelection}
          >
            Delete subcategory
          </button>
        </div>
        <div className="dim">Parent: {cat.label}</div>
        <div className="form-grid">
          <label>ID</label>
          <input
            type="text"
            value={sub.id}
            readOnly
            title="Internal rule ID. Rename the label instead."
          />
          <label>Label</label>
          <input
            type="text"
            value={sub.label}
            onChange={(e) => patch({ label: e.target.value })}
          />
          <label>Folder</label>
          <input
            type="text"
            value={sub.folder}
            onChange={(e) => patch({ folder: e.target.value })}
          />
          <label>Enabled</label>
          <input
            type="checkbox"
            checked={sub.enabled !== false}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <label>Tags</label>
          <StringListInput
            value={sub.tags ?? []}
            placeholder="comma, separated"
            onChange={(next) => patch({ tags: next })}
          />
          <label>Negative keywords</label>
          <StringListInput
            value={sub.negativeKeywords ?? []}
            placeholder="comma, separated"
            onChange={(next) => patch({ negativeKeywords: next })}
          />
        </div>
        <h4>Keywords</h4>
        <KeywordsTable
          keywords={sub.keywords ?? []}
          errors={errors}
          pathPrefix={`${path}/keywords`}
          onChange={(next) => patch({ keywords: next })}
        />
        <ErrorList issues={errors} pathPrefix={path} />
        <WarningList warnings={warnings} pathPrefix={path} />
      </div>
    )
  }

  if (selection.kind === 'project') {
    const pi = findProjectIndex(rules, selection.projectId)
    if (pi < 0) {
      return <div className="rules-detail rules-detail-empty">Project no longer exists.</div>
    }
    const proj = rules.projects[pi]
    const path = `/projects/${pi}`
    function patch(p: Partial<ClassifierRuleProject>): void {
      onChange(replaceProject(rules, proj.id, { ...proj, ...p }))
    }
    return (
      <div className="rules-detail">
        <div className="rules-detail-head">
          <h3>Project: {proj.label || '(unnamed)'}</h3>
          <button
            type="button"
            className="onboarding-secondary"
            onClick={onDeleteSelection}
          >
            Delete project
          </button>
        </div>
        <div className="form-grid">
          <label>ID</label>
          <input
            type="text"
            value={proj.id}
            readOnly
            title="Internal rule ID. Rename the label instead."
          />
          <label>Label</label>
          <input
            type="text"
            value={proj.label}
            onChange={(e) => patch({ label: e.target.value })}
          />
          <label>Folder</label>
          <input
            type="text"
            value={proj.folder}
            onChange={(e) => patch({ folder: e.target.value })}
          />
          <label>Priority</label>
          <input
            type="number"
            step="1"
            value={proj.priority ?? 5}
            onChange={(e) => patch({ priority: Number(e.target.value) })}
          />
          <label>Enabled</label>
          <input
            type="checkbox"
            checked={proj.enabled !== false}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <label>Tags</label>
          <StringListInput
            value={proj.tags ?? []}
            placeholder="comma, separated"
            onChange={(next) => patch({ tags: next })}
          />
          <label>Negative keywords</label>
          <StringListInput
            value={proj.negativeKeywords ?? []}
            placeholder="comma, separated"
            onChange={(next) => patch({ negativeKeywords: next })}
          />
          <label>Triggers</label>
          <StringListInput
            value={proj.triggers ?? []}
            placeholder="exact phrases, comma separated"
            onChange={(next) => patch({ triggers: next })}
          />
        </div>
        <p className="dim">
          Triggers are exact-phrase matches. Project priority &gt;= 5 overrides any category
          match.
        </p>
        <ErrorList issues={errors} pathPrefix={path} />
        <WarningList warnings={warnings} pathPrefix={path} />
      </div>
    )
  }

  return <></>
}
