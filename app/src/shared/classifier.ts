// Provider-agnostic classifier contract. Both the deterministic and Gemini
// classifiers in main implement Classifier, and the renderer never sees the
// implementation - it talks to classifier:classify over IPC.

import type { ClassifierRules } from './classifierRules'

export type ClassifierId = 'deterministic-v1' | 'ai-gemini-v1'
export type ClassifierProvider = 'deterministic' | 'gemini'
export type ReuseLevel = 'low' | 'medium' | 'high'
export type Scope = 'reusable' | 'one-off'
export type ConfidenceTier = 'high' | 'medium' | 'low'

export type ClassifierErrorCode =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'parse'
  | 'timeout'
  | 'safety-blocked'
  | 'secret-storage-unavailable'
  | 'rules-invalid'
  | 'unknown'

export interface ClassifierError {
  code: ClassifierErrorCode
  message: string
}

export interface ClassificationConfidence {
  score: number // 0..1
  tier: ConfidenceTier
}

export interface ClassificationAlternative {
  folder: string
  score: number
}

export interface ClassificationReasoning {
  matchedKeywords?: string[]
  matchedTriggers?: string[]
  suppressedBy?: string[]
  topAlternatives?: ClassificationAlternative[]
  notes: string[]
}

export interface ClassificationResult {
  classifierId: ClassifierId
  provider: ClassifierProvider
  title: string
  category: string
  subcategory?: string
  tags: string[]
  reuse: ReuseLevel
  scope: Scope
  recommendedFolder: string
  filename: string
  confidence: ClassificationConfidence
  reasoning: ClassificationReasoning
}

export interface ClassificationInput {
  rawText: string
  rules: ClassifierRules
  // Folder paths the classifier may legally recommend. Computed in main:
  // union of rule-referenced folders and folders that exist on disk.
  allowedFolders: string[]
  // Category labels the classifier may legally recommend, derived from
  // enabled categories in rules.
  allowedCategories: string[]
  // Optional deterministic result fed to AI providers as a hint.
  deterministicHint?: ClassificationResult
}

export interface Classifier {
  id: ClassifierId
  provider: ClassifierProvider
  classify(input: ClassificationInput): Promise<ClassificationResult>
}

// Map a numeric score 0..1 to a tier using the rules-supplied thresholds.
// Exported so tests, the deterministic classifier, and the Gemini
// post-processor can stay in sync.
export function scoreTier(
  score: number,
  thresholds: { highTier: number; mediumTier: number }
): ConfidenceTier {
  if (score >= thresholds.highTier) return 'high'
  if (score >= thresholds.mediumTier) return 'medium'
  return 'low'
}
