// Pattern-detector proposal that may, on user approval, mutate rules.json.
//
// Persistence: <library-root>/.prompt-librarian/rule-proposals.json (a
// JSON array of these objects, not JSONL, because we update status in
// place when the user accepts/rejects).
//
// Rejected proposals stay rejected across restarts to avoid nagging.

export const PROPOSAL_VERSION = 1

export type ProposalStatus = 'pending' | 'accepted' | 'rejected'
export type ProposalType =
  | 'keyword'
  | 'negativeKeyword'
  | 'projectTrigger'
  | 'category'
  | 'subcategory'

export interface ProposalEvidenceItem {
  timestamp: string
  rawTextPreview: string
  acceptedCategory: string
  acceptedFolder: string
}

export interface ProposalChange {
  // For keyword / negativeKeyword / projectTrigger: id of the rule being
  // augmented. For category / subcategory creation: the new id.
  targetRuleId: string
  keyword?: { term: string; weight: number }
  // Future-proofed for richer proposals (negativeKeyword/category creation).
  trigger?: string
  newCategory?: { id: string; label: string; folder: string }
  newSubcategory?: { id: string; label: string; folder: string; parentCategoryId: string }
}

export interface RuleProposal {
  id: string
  version: number
  createdAt: string
  updatedAt: string
  status: ProposalStatus
  type: ProposalType
  summary: string
  evidenceCount: number
  evidence: ProposalEvidenceItem[]
  proposedChange: ProposalChange
}

export interface ProposalStore {
  version: number
  proposals: RuleProposal[]
}
