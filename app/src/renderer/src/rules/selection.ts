// Selection model for the rules editor. Tagged union so the right pane
// can switch on `kind` without index lookups elsewhere.

export type RuleSelection =
  | { kind: 'category'; categoryId: string }
  | { kind: 'subcategory'; categoryId: string; subId: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'fallback' }
  | { kind: 'scoring' }
  | { kind: 'reuse' }
  | { kind: 'proposals' }
