// Editable review form for a ClassificationResult. The user adjusts any
// field before clicking Save. Save dispatches to the parent's handler,
// which calls prompt:save and surfaces collisions.

import { useState } from 'react'
import type {
  AiStatus,
  ClassifyFallbackMarker,
  RulesPayload,
  SaveResult
} from '../../../shared/ipc'
import type { DuplicateMatch } from '../../../shared/dedup'
import type {
  ClassificationResult,
  ConfidenceTier,
  ReuseLevel,
  Scope
} from '../../../shared/classifier'

interface Props {
  classification: ClassificationResult
  folders: string[]
  rulesPayload: RulesPayload | null
  aiStatus: AiStatus | null
  busy: boolean
  error: string | null
  // Phase 4B
  fallback?: ClassifyFallbackMarker | null
  deterministicSnapshot?: ClassificationResult | null
  duplicates?: DuplicateMatch[]
  onUpdate: (next: ClassificationResult) => void
  onImproveWithGemini: (() => void) | null
  onBack: () => void
  onSave: (
    draft: ClassificationResult,
    strategy: 'fail' | 'overwrite' | 'rename',
    newFilename?: string,
    addToTaxonomy?: boolean
  ) => Promise<SaveResult>
}

interface CollisionState {
  existing: string
  suggestedName: string
}

function tierLabel(t: ConfidenceTier, score: number): string {
  return `${t} (${Math.round(score * 100)}%)`
}

export default function ClassificationReview({
  classification,
  folders,
  rulesPayload,
  aiStatus,
  busy,
  error,
  fallback,
  deterministicSnapshot,
  duplicates,
  onUpdate,
  onImproveWithGemini,
  onBack,
  onSave
}: Props): JSX.Element {
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [collision, setCollision] = useState<CollisionState | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [showCompare, setShowCompare] = useState(false)
  const [addToTaxonomy, setAddToTaxonomy] = useState(false)

  const ruleFolders = rulesPayload
    ? Array.from(new Set([...folders, ...folderListFromRules(rulesPayload)]))
    : folders
  const ruleCategories = rulesPayload
    ? rulesPayload.rules.categories
        .filter((c) => c.enabled !== false)
        .map((c) => c.label)
    : []

  // Inline taxonomy-add affordance: only shown when the user's edited
  // category is not already in the active rule set. Comparison is
  // case-insensitive on the label.
  const categoryIsNew = (() => {
    if (!rulesPayload) return false
    const norm = classification.category.trim().toLowerCase()
    if (norm.length === 0) return false
    return !rulesPayload.rules.categories.some(
      (c) => c.label.trim().toLowerCase() === norm
    )
  })()

  // Folder affordance: the field is free text, so the user can type a
  // brand-new folder path. It does not exist on disk until save creates
  // it (savePrompt does a recursive mkdir). Surface that explicitly.
  const folderValue = classification.recommendedFolder.trim()
  const folderWillBeCreated = folderValue.length > 0 && !folders.includes(folderValue)

  const dupes = duplicates ?? []
  const hasExactDupe = dupes.some((d) => d.matchType === 'exact')

  function patch<K extends keyof ClassificationResult>(
    key: K,
    value: ClassificationResult[K]
  ): void {
    onUpdate({ ...classification, [key]: value })
  }

  async function attemptSave(
    strategy: 'fail' | 'overwrite' | 'rename',
    newName?: string
  ): Promise<void> {
    setSaveBusy(true)
    setSaveError(null)
    try {
      const result = await onSave(
        classification,
        strategy,
        newName,
        categoryIsNew && addToTaxonomy
      )
      if (result.ok) {
        setCollision(null)
        return
      }
      if (result.collision) {
        setCollision({
          existing: result.relPath ?? classification.filename,
          suggestedName: bumpFilename(classification.filename)
        })
        setRenameInput(bumpFilename(classification.filename))
        return
      }
      setSaveError(result.error ?? 'Save failed.')
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <div className="intake-review">
      {dupes.length > 0 && (
        <section className="modal-section">
          <div className="onboarding-error intake-dupe-warning">
            <strong>
              {hasExactDupe
                ? 'You already saved this prompt.'
                : 'This looks very similar to a prompt you already saved.'}
            </strong>
            <ul className="intake-dupe-list">
              {dupes.slice(0, 5).map((d) => (
                <li key={d.relPath}>
                  <code>{d.relPath}</code>{' '}
                  <span className="dim">
                    ({d.matchType === 'exact' ? 'exact' : `near, ${Math.round(d.similarity * 100)}%`})
                  </span>
                </li>
              ))}
            </ul>
            <div className="dim">
              Saving anyway will create a separate copy. This is fine if you meant to.
            </div>
          </div>
        </section>
      )}

      {fallback && (
        <section className="modal-section">
          <div className="onboarding-info">
            Gemini unavailable - deterministic result shown. Reason: {fallback.reason}.
            {deterministicSnapshot && (
              <button
                type="button"
                className="onboarding-secondary"
                style={{ marginLeft: 8 }}
                onClick={() => setShowCompare((v) => !v)}
              >
                {showCompare ? 'Hide deterministic result' : 'Show deterministic result'}
              </button>
            )}
          </div>
          {showCompare && deterministicSnapshot && (
            <div className="dim">
              Deterministic suggested: <strong>{deterministicSnapshot.category}</strong> -{' '}
              {deterministicSnapshot.recommendedFolder}
            </div>
          )}
        </section>
      )}

      <section className="modal-section">
        <div className="phase1-label">
          {classification.classifierId === 'ai-gemini-v1' ? 'Suggested by Gemini' : 'Suggested locally'}
          <span className="confidence-chip" data-tier={classification.confidence.tier}>
            {tierLabel(classification.confidence.tier, classification.confidence.score)}
          </span>
        </div>
        <div className="form-grid">
          <label>Title</label>
          <input
            type="text"
            value={classification.title}
            onChange={(e) => patch('title', e.target.value)}
          />

          <label>Category</label>
          <input
            type="text"
            value={classification.category}
            onChange={(e) => patch('category', e.target.value)}
            list="intake-category-list"
          />
          <datalist id="intake-category-list">
            {ruleCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <label>Subcategory</label>
          <input
            type="text"
            value={classification.subcategory ?? ''}
            onChange={(e) => patch('subcategory', e.target.value || undefined)}
          />

          <label>Tags</label>
          <input
            type="text"
            value={classification.tags.join(', ')}
            onChange={(e) =>
              patch(
                'tags',
                e.target.value
                  .split(',')
                  .map((t) => t.trim().toLowerCase())
                  .filter((t) => t.length > 0)
              )
            }
            placeholder="comma, separated, lowercase"
          />

          <label>Reuse</label>
          <select
            value={classification.reuse}
            onChange={(e) => patch('reuse', e.target.value as ReuseLevel)}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>

          <label>Scope</label>
          <select
            value={classification.scope}
            onChange={(e) => patch('scope', e.target.value as Scope)}
          >
            <option value="reusable">reusable</option>
            <option value="one-off">one-off</option>
          </select>

          <label>Folder</label>
          <div className="intake-folder-field">
            <input
              type="text"
              value={classification.recommendedFolder}
              onChange={(e) => patch('recommendedFolder', e.target.value)}
              list="intake-folder-list"
              placeholder="Pick an existing folder or type a new path to create it"
            />
            <datalist id="intake-folder-list">
              {ruleFolders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            {folderWillBeCreated ? (
              <div className="onboarding-info intake-folder-hint">
                New folder - <code>{folderValue}</code> will be created on save.
              </div>
            ) : (
              <div className="dim intake-folder-hint">
                Type a new path (e.g. <code>03-Job Search</code>) to create a folder on save.
              </div>
            )}
          </div>

          <label>Filename</label>
          <input
            type="text"
            value={classification.filename}
            onChange={(e) => patch('filename', e.target.value)}
          />
        </div>
        {categoryIsNew && (
          <div className="intake-inline-add">
            <label>New category detected</label>
            <label className="radio-row">
              <input
                type="checkbox"
                checked={addToTaxonomy}
                onChange={(e) => setAddToTaxonomy(e.target.checked)}
              />
              Add &quot;{classification.category}&quot; to your taxonomy for future prompts
            </label>
            <div className="dim">
              Rules are only updated after a successful save. Cancel leaves rules.json
              untouched.
            </div>
          </div>
        )}
      </section>

      <section className="modal-section reasoning">
        <div className="phase1-label">Reasoning</div>
        {classification.reasoning.matchedKeywords && classification.reasoning.matchedKeywords.length > 0 && (
          <div className="dim">
            Matched keywords: {classification.reasoning.matchedKeywords.join(', ')}
          </div>
        )}
        {classification.reasoning.matchedTriggers && classification.reasoning.matchedTriggers.length > 0 && (
          <div className="dim">
            Project triggers: {classification.reasoning.matchedTriggers.join(', ')}
          </div>
        )}
        {classification.reasoning.suppressedBy && classification.reasoning.suppressedBy.length > 0 && (
          <div className="dim">
            Suppressed by negative keywords: {classification.reasoning.suppressedBy.join(', ')}
          </div>
        )}
        {classification.reasoning.topAlternatives && classification.reasoning.topAlternatives.length > 0 && (
          <div className="dim">
            Alternatives:{' '}
            {classification.reasoning.topAlternatives
              .map((a) => `${a.folder} (${Math.round(a.score * 100)}%)`)
              .join(', ')}
          </div>
        )}
        {classification.reasoning.notes.map((n, i) => (
          <div key={i} className="dim">- {n}</div>
        ))}
      </section>

      {saveError && (
        <section className="modal-section">
          <div className="onboarding-error">{saveError}</div>
        </section>
      )}

      {error && (
        <section className="modal-section">
          <div className="onboarding-error">{error}</div>
        </section>
      )}

      {collision && (
        <section className="modal-section">
          <div className="onboarding-info">
            A file already exists at <code>{collision.existing}</code>. Pick a new filename
            to save without overwriting:
          </div>
          <div className="modal-actions">
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
            />
            <button
              className="onboarding-secondary"
              onClick={() => attemptSave('rename', renameInput)}
              disabled={saveBusy || renameInput.length === 0}
            >
              Save as new filename
            </button>
            <button
              className="onboarding-secondary"
              onClick={() => attemptSave('overwrite')}
              disabled={saveBusy}
            >
              Overwrite existing
            </button>
            <button className="onboarding-secondary" onClick={() => setCollision(null)}>
              Back to edit
            </button>
          </div>
        </section>
      )}

      <section className="modal-section">
        <div className="modal-actions">
          <button
            className="onboarding-secondary"
            onClick={onBack}
            disabled={saveBusy || busy}
          >
            Back
          </button>
          {onImproveWithGemini && (
            <button
              className="onboarding-secondary"
              onClick={onImproveWithGemini}
              disabled={saveBusy || busy}
            >
              {busy ? 'Calling Gemini...' : 'Improve with Gemini'}
            </button>
          )}
          {!collision && (
            <button
              className="onboarding-primary"
              onClick={() => attemptSave('fail')}
              disabled={saveBusy || busy}
            >
              {saveBusy ? 'Saving...' : dupes.length > 0 ? 'Save anyway' : 'Save'}
            </button>
          )}
        </div>
        {!aiStatus?.geminiAvailable && (
          <div className="dim">Gemini unavailable: configure a key in Settings.</div>
        )}
      </section>
    </div>
  )
}

function folderListFromRules(payload: RulesPayload): string[] {
  const out: string[] = []
  for (const cat of payload.rules.categories) {
    out.push(cat.folder)
    for (const sub of cat.subcategories ?? []) out.push(sub.folder)
  }
  for (const proj of payload.rules.projects) out.push(proj.folder)
  out.push(payload.rules.fallback.folder)
  return out
}

function bumpFilename(name: string): string {
  // Append "-2" before the extension. Used as a default when a save
  // collision is reported.
  const m = /^(.*?)(\.md)?$/i.exec(name)
  if (!m) return name + '-2'
  const base = m[1]
  const ext = m[2] || '.md'
  const numbered = /^(.*)-(\d+)$/.exec(base)
  if (numbered) {
    return `${numbered[1]}-${parseInt(numbered[2], 10) + 1}${ext}`
  }
  return `${base}-2${ext}`
}
