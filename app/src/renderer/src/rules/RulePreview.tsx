// "Test this rule" panel. Pastes a prompt, runs the shared deterministic
// classifier against the UNSAVED draft rules + currently-known folders, and
// shows the result. Renderer-only - no main IPC.

import { useMemo, useState } from 'react'
import { classifyDeterministic } from '../../../shared/classifier/deterministic'
import type { ClassifierRules } from '../../../shared/classifierRules'
import { listEnabledCategoryLabels } from '../../../shared/classifierRules'

interface Props {
  draftRules: ClassifierRules
  folders: string[]
}

export default function RulePreview({ draftRules, folders }: Props): JSX.Element {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState('')

  const result = useMemo(() => {
    if (submitted.length === 0) return null
    return classifyDeterministic({
      rawText: submitted,
      rules: draftRules,
      allowedFolders: folders,
      allowedCategories: listEnabledCategoryLabels(draftRules)
    })
  }, [submitted, draftRules, folders])

  return (
    <section className="rules-preview">
      <div className="phase1-label">Test this rule</div>
      <p className="dim">
        Paste a prompt to see how it would classify against your unsaved draft. Uses the
        deterministic classifier - same logic the app runs.
      </p>
      <textarea
        rows={4}
        value={text}
        placeholder="Paste a prompt here..."
        onChange={(e) => setText(e.target.value)}
      />
      <div className="modal-actions">
        <button
          type="button"
          className="onboarding-primary"
          disabled={text.trim().length === 0}
          onClick={() => setSubmitted(text)}
        >
          Classify
        </button>
        <button
          type="button"
          className="onboarding-secondary"
          onClick={() => {
            setText('')
            setSubmitted('')
          }}
        >
          Clear
        </button>
      </div>

      {result && (
        <div className="rules-preview-result">
          <div className="phase1-label">
            Result
            <span className="confidence-chip" data-tier={result.confidence.tier}>
              {result.confidence.tier} ({Math.round(result.confidence.score * 100)}%)
            </span>
          </div>
          <div>
            <strong>Category:</strong> {result.category}
            {result.subcategory && ` / ${result.subcategory}`}
          </div>
          <div>
            <strong>Folder:</strong> {result.recommendedFolder}
          </div>
          <div>
            <strong>Tags:</strong> {result.tags.join(', ') || <span className="dim">none</span>}
          </div>
          {(result.reasoning.matchedKeywords ?? []).length > 0 && (
            <div className="dim">
              Matched keywords: {(result.reasoning.matchedKeywords ?? []).join(', ')}
            </div>
          )}
          {(result.reasoning.matchedTriggers ?? []).length > 0 && (
            <div className="dim">
              Project triggers: {(result.reasoning.matchedTriggers ?? []).join(', ')}
            </div>
          )}
          {result.reasoning.suppressedBy && result.reasoning.suppressedBy.length > 0 && (
            <div className="dim">
              Suppressed by negative keywords: {result.reasoning.suppressedBy.join(', ')}
            </div>
          )}
          {(result.reasoning.topAlternatives ?? []).length > 0 && (
            <div className="dim">
              Alternatives:{' '}
              {(result.reasoning.topAlternatives ?? [])
                .map((a) => `${a.folder} (${Math.round(a.score * 100)}%)`)
                .join(', ')}
            </div>
          )}
          {result.reasoning.notes.map((n, i) => (
            <div key={i} className="dim">- {n}</div>
          ))}
        </div>
      )}
    </section>
  )
}
