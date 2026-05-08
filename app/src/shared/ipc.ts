// Shared IPC contract between main process and renderer.
// Channel names are referenced by both preload and main.

import type { ClassifierProvider, ClassificationResult, ClassifierError } from './classifier'
import type { ClassifierRules, ClassifierRulesValidation } from './classifierRules'

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
  rulesGet: 'rules:get',
  rulesGetPath: 'rules:getPath',
  rulesOpenInEditor: 'rules:openInEditor',
  rulesReset: 'rules:reset',
  rulesReload: 'rules:reload',
  settingsGetClassifierProvider: 'settings:getClassifierProvider',
  settingsSetClassifierProvider: 'settings:setClassifierProvider',
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

export const DEFAULT_LIBRARY_FOLDERS = [
  '00-Index',
  '01-Core Transforms',
  '02-Interview',
  '03-Job Search',
  '04-Product Specs',
  '05-Research',
  '06-Project Prompts',
  '06-Project Prompts/Career Buddy',
  '06-Project Prompts/OpenClaw',
  '90-Examples',
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

export type ClassifyResponse =
  | { ok: true; result: ClassificationResult }
  | { ok: false; error: ClassifierError }

export interface AiStatus {
  provider: ClassifierProvider
  geminiAvailable: boolean
  // Where the key came from. 'env' means a process env var, 'stored' means
  // safeStorage, 'none' means unavailable.
  keySource: 'env' | 'stored' | 'none'
  model: string | null
  // Model couldn't be verified at app build time and the user must set
  // PROMPT_LIBRARIAN_GEMINI_MODEL or accept the documented default. Also
  // true if safeStorage is unavailable on this OS.
  warnings: string[]
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
  getAiStatus(): Promise<AiStatus>
  getRules(): Promise<RulesPayload>
  getRulesPath(): Promise<string | null>
  openRulesInEditor(): Promise<{ ok: boolean; error?: string }>
  resetRules(): Promise<RulesResetResponse>
  reloadRules(): Promise<RulesPayload>
  getClassifierProvider(): Promise<ClassifierProvider>
  setClassifierProvider(p: ClassifierProvider): Promise<void>
  hasGeminiApiKey(): Promise<{ has: boolean; source: 'env' | 'stored' | 'none' }>
  setGeminiApiKey(key: string): Promise<SecretSetResponse>
  clearGeminiApiKey(): Promise<{ ok: boolean }>
}
