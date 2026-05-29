// Shared IPC contract between main process and renderer.
// Channel names are referenced by both preload and main.

import type { ClassifierProvider, ClassificationResult, ClassifierError, ClassifierErrorCode } from './classifier'
import type { ClassifierRules, ClassifierRulesValidation } from './classifierRules'
import type { Correction, CorrectionMetadata } from './correction'
import type { RuleProposal } from './proposal'
import type { DuplicateMatch } from './dedup'

export const IPC = {
  settingsGetRootPath: 'settings:getRootPath',
  settingsSetRootPath: 'settings:setRootPath',
  dialogChooseFolder: 'dialog:chooseFolder',
  libraryInit: 'library:init',
  libraryCheckRoot: 'library:checkRoot',
  libraryScan: 'library:scan',
  libraryListFolders: 'library:listFolders',
  promptSave: 'prompt:save',
  promptMove: 'prompt:move',
  promptArchive: 'prompt:archive',
  classifierClassify: 'classifier:classify',
  classifierGetAiStatus: 'classifier:getAiStatus',
  dedupCheck: 'dedup:check',
  rulesGet: 'rules:get',
  rulesGetPath: 'rules:getPath',
  rulesOpenInEditor: 'rules:openInEditor',
  rulesReset: 'rules:reset',
  rulesReload: 'rules:reload',
  rulesWrite: 'rules:write',
  rulesExport: 'rules:export',
  rulesImport: 'rules:import',
  correctionsAppend: 'corrections:append',
  correctionsList: 'corrections:list',
  correctionsClear: 'corrections:clear',
  correctionsCount: 'corrections:count',
  proposalsList: 'proposals:list',
  proposalsAccept: 'proposals:accept',
  proposalsReject: 'proposals:reject',
  proposalsAnalyze: 'proposals:analyze',
  learningGetSettings: 'learning:getSettings',
  learningSetSettings: 'learning:setSettings',
  learningOpenFolder: 'learning:openFolder',
  settingsGetClassifierProvider: 'settings:getClassifierProvider',
  settingsSetClassifierProvider: 'settings:setClassifierProvider',
  settingsGetGeminiDisclosureAck: 'settings:getGeminiDisclosureAck',
  settingsSetGeminiDisclosureAck: 'settings:setGeminiDisclosureAck',
  settingsHasGeminiApiKey: 'settings:hasGeminiApiKey',
  settingsSetGeminiApiKey: 'settings:setGeminiApiKey',
  settingsClearGeminiApiKey: 'settings:clearGeminiApiKey'
} as const

export type ReuseLevel = 'low' | 'medium' | 'high'
export type Scope = 'reusable' | 'one-off'

export interface PromptFrontmatter {
  title: string
  category?: string
  subcategory?: string
  tags?: string[]
  reuse?: ReuseLevel
  scope?: Scope
  created_at?: string
  updated_at?: string
  [extra: string]: unknown
}

export interface Prompt {
  relPath: string
  folder: string
  filename: string
  frontmatter: PromptFrontmatter
  body: string
}

export interface PromptDraft {
  folder: string
  filename: string
  frontmatter: PromptFrontmatter
  body: string
}

export type SaveCollisionStrategy = 'fail' | 'overwrite' | 'rename'

export interface SaveOptions {
  strategy?: SaveCollisionStrategy
  newFilename?: string
}

export interface SaveResult {
  ok: boolean
  collision?: boolean
  path?: string
  relPath?: string
  error?: string
}

export interface InitResult {
  ok: boolean
  rootPath: string
  created: string[]
  alreadyExisted: string[]
  errors: string[]
}

export type CheckRootResult =
  | { ok: true; rootPath: string }
  | { ok: false; rootPath: string | null; reason: 'unset' | 'missing' | 'not-directory' | 'error'; error?: string }

export interface MoveResult {
  ok: boolean
  newRelPath?: string
  collision?: boolean
  autoRenamed?: boolean
  error?: string
}

// Minimal generic starter folders matching DEFAULT_CLASSIFIER_RULES plus
// the always-present fallback (00-Index) and archive (99-Archive). Phase 4B.
export const DEFAULT_LIBRARY_FOLDERS = [
  '00-Index',
  '01-Transform',
  '01-Transform/Transcript Cleanup',
  '02-Create',
  '02-Create/Prompt Template',
  '99-Archive'
] as const

export const ARCHIVE_FOLDER = '99-Archive'

export interface ClassifyRequest {
  rawText: string
  // 'auto' uses the Settings-configured default. Otherwise force a provider.
  provider?: ClassifierProvider | 'auto'
  // When provider is 'gemini', the renderer must echo back the deterministic
  // hint so the AI can use it without re-running locally.
  deterministicHint?: ClassificationResult
}

// Phase 4B: when ok=true we may also include a fallback marker explaining
// that Gemini was attempted but failed and the result shown is the local
// deterministic fallback. The renderer surfaces this as an inline note.
export interface ClassifyFallbackMarker {
  fromProvider: ClassifierProvider
  to: ClassifierProvider
  reason: ClassifierErrorCode
  message: string
}

export type ClassifyResponse =
  | { ok: true; result: ClassificationResult; fallback?: ClassifyFallbackMarker }
  | { ok: false; error: ClassifierError }

export interface AiStatus {
  // The effective provider that will be used right now.
  provider: ClassifierProvider
  // What the user explicitly chose, if anything.
  manualOverride: ClassifierProvider | null
  geminiAvailable: boolean
  keySource: 'env' | 'stored' | 'none'
  model: string | null
  warnings: string[]
}

export interface LearningSettings {
  useCorrectionsAsExamples: boolean
  suggestRuleAdditions: boolean
  correctionCount: number
  pendingProposalCount: number
}

export interface ImportRulesResponse {
  ok: boolean
  rules?: RulesPayload
  error?: string
}

export interface ExportRulesResponse {
  ok: boolean
  path?: string
  error?: string
}

export interface RulesPayload {
  rules: ClassifierRules
  validation: ClassifierRulesValidation
  // True when the file on disk is invalid and we are using DEFAULT rules
  // for this session. The renderer surfaces this as a non-fatal banner.
  usingDefaults: boolean
  path: string
}

export interface RulesResetResponse {
  ok: boolean
  path: string
  error?: string
}

export interface SecretSetResponse {
  ok: boolean
  // Set when ok=false because OS keychain encryption isn't available.
  error?: 'secret-storage-unavailable' | 'unknown'
  message?: string
}

export interface PromptLibrarianApi {
  getRootPath(): Promise<string | null>
  setRootPath(p: string): Promise<void>
  chooseFolder(defaultPath?: string): Promise<string | null>
  initLibrary(rootPath: string): Promise<InitResult>
  checkRoot(): Promise<CheckRootResult>
  scanLibrary(): Promise<Prompt[]>
  listFolders(): Promise<string[]>
  savePrompt(draft: PromptDraft, opts?: SaveOptions): Promise<SaveResult>
  movePrompt(currentRelPath: string, newFolder: string): Promise<MoveResult>
  archivePrompt(currentRelPath: string): Promise<MoveResult>
  classify(req: ClassifyRequest): Promise<ClassifyResponse>
  // Phase 4B: local, offline duplicate detection against the saved library.
  checkDuplicate(rawText: string): Promise<DuplicateMatch[]>
  getAiStatus(): Promise<AiStatus>
  getRules(): Promise<RulesPayload>
  getRulesPath(): Promise<string | null>
  openRulesInEditor(): Promise<{ ok: boolean; error?: string }>
  resetRules(): Promise<RulesResetResponse>
  reloadRules(): Promise<RulesPayload>
  writeRules(rules: ClassifierRules): Promise<RulesPayload>
  exportRules(): Promise<ExportRulesResponse>
  importRules(): Promise<ImportRulesResponse>
  // Phase 4A backwards-compat: still works, treated as a manual override.
  // Phase 4B: 'auto' clears the manual override so the AI-default rule
  // applies (Gemini if key, deterministic otherwise).
  getClassifierProvider(): Promise<ClassifierProvider>
  setClassifierProvider(p: ClassifierProvider | 'auto'): Promise<void>
  // Phase 4B: one-time Gemini disclosure acknowledgment, persisted.
  getGeminiDisclosureAck(): Promise<boolean>
  setGeminiDisclosureAck(v: boolean): Promise<void>
  hasGeminiApiKey(): Promise<{ has: boolean; source: 'env' | 'stored' | 'none' }>
  setGeminiApiKey(key: string): Promise<SecretSetResponse>
  clearGeminiApiKey(): Promise<{ ok: boolean }>
  // Phase 4B learning loop:
  appendCorrection(payload: AppendCorrectionPayload): Promise<{ ok: boolean; created?: RuleProposal[] }>
  listCorrections(): Promise<{ corrections: Correction[]; malformedLineCount: number }>
  countCorrections(): Promise<number>
  clearCorrections(): Promise<{ ok: boolean }>
  listProposals(): Promise<{ proposals: RuleProposal[] }>
  acceptProposal(id: string): Promise<{ ok: boolean; rules?: RulesPayload; error?: string }>
  rejectProposal(id: string): Promise<{ ok: boolean }>
  analyzeCorrections(): Promise<{ created: RuleProposal[] }>
  getLearningSettings(): Promise<LearningSettings>
  setLearningSettings(s: Partial<LearningSettings>): Promise<LearningSettings>
  openLearningFolder(): Promise<{ ok: boolean; error?: string }>
}

export interface AppendCorrectionPayload {
  rawText: string
  classifierId: 'deterministic-v1' | 'ai-gemini-v1'
  provider: ClassifierProvider
  suggested: CorrectionMetadata
  accepted: CorrectionMetadata
  matchedKeywords?: string[]
  matchedTriggers?: string[]
}
