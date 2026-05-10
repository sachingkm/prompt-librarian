// Full-screen visual rules editor (Phase 4B). Three-pane layout:
//
//   left:  tree of categories / projects / settings / proposals
//   right: detail editor for the selected node
//   below: "Test this rule" preview using the shared deterministic classifier
//
// Edits are kept in a local draft until the user clicks Save. Save is
// blocked when validation fails. Discard reverts to the last loaded
// rules. The renderer never touches disk - all writes go through main.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClassifierRules } from '../../../shared/classifierRules'
import {
  collectRuleFolders,
  validateClassifierRules
} from '../../../shared/classifierRules'
import type { RulesPayload } from '../../../shared/ipc'
import type { RuleProposal } from '../../../shared/proposal'
import ProposalsPanel from './ProposalsPanel'
import RuleDetail from './RuleDetail'
import RulePreview from './RulePreview'
import RulesTreeView from './RulesTreeView'
import { diffAgainstDefaults } from './diff'
import type { RuleSelection } from './selection'

interface Props {
  onClose: () => void
  onRulesChanged?: () => void
}

function slugify(input: string, existing: Set<string>): string {
  let base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (base.length === 0) base = 'new'
  let candidate = base
  let i = 2
  while (existing.has(candidate)) {
    candidate = `${base}-${i++}`
  }
  return candidate
}

export default function RulesEditor({ onClose, onRulesChanged }: Props): JSX.Element {
  const [initialRules, setInitialRules] = useState<ClassifierRules | null>(null)
  const [draft, setDraft] = useState<ClassifierRules | null>(null)
  const [serverPayload, setServerPayload] = useState<RulesPayload | null>(null)
  const [selection, setSelection] = useState<RuleSelection | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [proposals, setProposals] = useState<RuleProposal[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [payload, folderList, props] = await Promise.all([
        window.api.getRules(),
        window.api.listFolders(),
        window.api.listProposals()
      ])
      setServerPayload(payload)
      setInitialRules(payload.rules)
      setDraft(payload.rules)
      setFolders(folderList)
      setProposals(props.proposals)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Local validation of the draft. We include knownFolders so renderer
  // surfaces the same "folder not present" warnings as main.
  const validation = useMemo(() => {
    if (!draft) return null
    return validateClassifierRules(draft, folders)
  }, [draft, folders])

  const diff = useMemo(() => {
    if (!draft) return null
    return diffAgainstDefaults(draft)
  }, [draft])

  const isDirty = useMemo(() => {
    if (!draft || !initialRules) return false
    return JSON.stringify(draft) !== JSON.stringify(initialRules)
  }, [draft, initialRules])

  const referencedFolders = useMemo(() => {
    if (!draft) return folders
    return Array.from(new Set([...folders, ...collectRuleFolders(draft)]))
  }, [draft, folders])

  const pendingProposalCount = useMemo(
    () => proposals.filter((p) => p.status === 'pending').length,
    [proposals]
  )

  async function save(): Promise<void> {
    if (!draft) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const result = await window.api.writeRules(draft)
      setServerPayload(result)
      if (result.validation.ok) {
        setInitialRules(result.rules)
        setDraft(result.rules)
        setInfo('Rules saved.')
        if (onRulesChanged) onRulesChanged()
      } else {
        setError('Validation failed - changes not written. See errors below.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function discard(): void {
    if (!initialRules) return
    setDraft(initialRules)
    setInfo('Discarded unsaved changes.')
    setError(null)
  }

  function addCategory(): void {
    if (!draft) return
    const existing = new Set(draft.categories.map((c) => c.id))
    const id = slugify('new-category', existing)
    const next: ClassifierRules = {
      ...draft,
      categories: [
        ...draft.categories,
        {
          id,
          label: 'New category',
          folder: '',
          enabled: true,
          priority: 0,
          keywords: [],
          tags: []
        }
      ]
    }
    setDraft(next)
    setSelection({ kind: 'category', categoryId: id })
  }

  function addProject(): void {
    if (!draft) return
    const existing = new Set(draft.projects.map((p) => p.id))
    const id = slugify('new-project', existing)
    const next: ClassifierRules = {
      ...draft,
      projects: [
        ...draft.projects,
        {
          id,
          label: 'New project',
          folder: '',
          enabled: true,
          priority: 5,
          triggers: [],
          tags: []
        }
      ]
    }
    setDraft(next)
    setSelection({ kind: 'project', projectId: id })
  }

  function addSubcategory(categoryId: string): void {
    if (!draft) return
    const ci = draft.categories.findIndex((c) => c.id === categoryId)
    if (ci < 0) return
    const cat = draft.categories[ci]
    const existing = new Set((cat.subcategories ?? []).map((s) => s.id))
    const id = slugify('new-subcategory', existing)
    const subs = [
      ...(cat.subcategories ?? []),
      {
        id,
        label: 'New subcategory',
        folder: '',
        enabled: true,
        keywords: []
      }
    ]
    const cats = draft.categories.slice()
    cats[ci] = { ...cat, subcategories: subs }
    setDraft({ ...draft, categories: cats })
    setSelection({ kind: 'subcategory', categoryId: cat.id, subId: id })
  }

  function deleteSelection(): void {
    if (!draft || !selection) return
    if (selection.kind === 'category') {
      const next = draft.categories.filter((c) => c.id !== selection.categoryId)
      setDraft({ ...draft, categories: next })
      setSelection(null)
    } else if (selection.kind === 'subcategory') {
      const ci = draft.categories.findIndex((c) => c.id === selection.categoryId)
      if (ci < 0) return
      const cat = draft.categories[ci]
      const subs = (cat.subcategories ?? []).filter((s) => s.id !== selection.subId)
      const cats = draft.categories.slice()
      cats[ci] = { ...cat, subcategories: subs }
      setDraft({ ...draft, categories: cats })
      setSelection({ kind: 'category', categoryId: cat.id })
    } else if (selection.kind === 'project') {
      const next = draft.projects.filter((p) => p.id !== selection.projectId)
      setDraft({ ...draft, projects: next })
      setSelection(null)
    }
  }

  async function acceptProposal(
    id: string
  ): Promise<{ ok: boolean; rules?: RulesPayload; error?: string }> {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.acceptProposal(id)
      if (!result.ok) {
        setError(result.error ?? 'Accept failed.')
      } else if (result.rules) {
        setServerPayload(result.rules)
        setInitialRules(result.rules.rules)
        setDraft(result.rules.rules)
        if (onRulesChanged) onRulesChanged()
      }
      const props = await window.api.listProposals()
      setProposals(props.proposals)
      return result
    } finally {
      setBusy(false)
    }
  }

  async function rejectProposal(id: string): Promise<{ ok: boolean }> {
    setBusy(true)
    try {
      const result = await window.api.rejectProposal(id)
      const props = await window.api.listProposals()
      setProposals(props.proposals)
      return result
    } finally {
      setBusy(false)
    }
  }

  async function analyzeProposals(): Promise<void> {
    setBusy(true)
    try {
      await window.api.analyzeCorrections()
      const props = await window.api.listProposals()
      setProposals(props.proposals)
    } finally {
      setBusy(false)
    }
  }

  async function refreshProposals(): Promise<void> {
    const props = await window.api.listProposals()
    setProposals(props.proposals)
  }

  if (!draft || !validation || !diff) {
    return (
      <div className="rules-editor-shell">
        <header className="rules-editor-head">
          <h2>Taxonomy editor</h2>
          <button onClick={onClose} className="onboarding-secondary">
            Close
          </button>
        </header>
        <div className="rules-editor-body">
          <div className="dim">Loading rules...</div>
          {error && <div className="onboarding-error">{error}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="rules-editor-shell">
      <header className="rules-editor-head">
        <div className="rules-editor-title">
          <h2>Taxonomy editor</h2>
          {serverPayload?.path && <span className="dim">{serverPayload.path}</span>}
          {serverPayload?.usingDefaults && (
            <span className="rules-pending-badge">file invalid - using defaults</span>
          )}
        </div>
        <div className="modal-actions">
          <button
            className="onboarding-secondary"
            onClick={discard}
            disabled={busy || !isDirty}
          >
            Discard
          </button>
          <button
            className="onboarding-primary"
            onClick={save}
            disabled={busy || !isDirty || !validation.ok}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
          <button className="onboarding-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      </header>

      {error && <div className="onboarding-error rules-editor-banner">{error}</div>}
      {info && <div className="onboarding-info rules-editor-banner">{info}</div>}
      {!validation.ok && (
        <div className="onboarding-error rules-editor-banner">
          Draft has {validation.errors.length} validation error(s). Save is disabled until
          they are fixed.
        </div>
      )}

      <div className="rules-editor-body">
        <aside className="rules-editor-sidebar">
          <RulesTreeView
            rules={draft}
            selection={selection}
            diff={diff}
            pendingProposalCount={pendingProposalCount}
            onSelect={setSelection}
            onAddCategory={addCategory}
            onAddProject={addProject}
            onAddSubcategory={addSubcategory}
          />
        </aside>
        <section className="rules-editor-detail">
          {selection?.kind === 'proposals' ? (
            <ProposalsPanel
              proposals={proposals}
              busy={busy}
              onAccept={acceptProposal}
              onReject={rejectProposal}
              onRefresh={refreshProposals}
              onAnalyze={analyzeProposals}
            />
          ) : (
            <RuleDetail
              rules={draft}
              selection={selection}
              errors={validation.errors}
              warnings={validation.warnings}
              onChange={setDraft}
              onDeleteSelection={deleteSelection}
            />
          )}
          <RulePreview draftRules={draft} folders={referencedFolders} />
        </section>
      </div>
    </div>
  )
}
