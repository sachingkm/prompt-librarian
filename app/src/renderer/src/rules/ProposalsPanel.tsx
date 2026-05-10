// Pending proposals list. Each proposal has Accept/Reject buttons. Accept
// calls window.api.acceptProposal which writes rules.json on the main
// side and returns the new payload, so the editor reloads.

import type { RuleProposal } from '../../../shared/proposal'
import type { RulesPayload } from '../../../shared/ipc'

interface Props {
  proposals: RuleProposal[]
  busy: boolean
  onAccept: (id: string) => Promise<{ ok: boolean; rules?: RulesPayload; error?: string }>
  onReject: (id: string) => Promise<{ ok: boolean }>
  onRefresh: () => Promise<void>
  onAnalyze: () => Promise<void>
}

function describeChange(p: RuleProposal): string {
  if (p.type === 'keyword' && p.proposedChange.keyword) {
    return `Add keyword "${p.proposedChange.keyword.term}" (weight ${p.proposedChange.keyword.weight}) to category "${p.proposedChange.targetRuleId}"`
  }
  return p.summary
}

export default function ProposalsPanel({
  proposals,
  busy,
  onAccept,
  onReject,
  onRefresh,
  onAnalyze
}: Props): JSX.Element {
  const pending = proposals.filter((p) => p.status === 'pending')
  return (
    <div className="rules-detail">
      <div className="rules-detail-head">
        <h3>Pending proposals</h3>
        <div className="modal-actions">
          <button
            type="button"
            className="onboarding-secondary"
            onClick={() => void onAnalyze()}
            disabled={busy}
          >
            Analyze corrections
          </button>
          <button
            type="button"
            className="onboarding-secondary"
            onClick={() => void onRefresh()}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="dim">
        These come from your recent corrections. Accept to add the rule and rewrite
        rules.json; reject to dismiss the suggestion. Saved prompts are never reclassified.
      </p>
      {pending.length === 0 && (
        <div className="dim">No pending proposals.</div>
      )}
      <ul className="rules-proposals">
        {pending.map((p) => (
          <li key={p.id} className="rules-proposal-row">
            <div>
              <div className="rules-proposal-summary">{describeChange(p)}</div>
              <div className="dim">
                Evidence: {p.evidenceCount} correction(s) - target "{p.proposedChange.targetRuleId}"
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="onboarding-primary"
                disabled={busy}
                onClick={() => void onAccept(p.id)}
              >
                Accept
              </button>
              <button
                type="button"
                className="onboarding-secondary"
                disabled={busy}
                onClick={() => void onReject(p.id)}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
