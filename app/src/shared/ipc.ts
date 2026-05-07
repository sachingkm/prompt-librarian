// Shared IPC contract between main process and renderer.
// Channel names are referenced by both preload and main.

export const IPC = {
  settingsGetRootPath: 'settings:getRootPath',
  settingsSetRootPath: 'settings:setRootPath',
  dialogChooseFolder: 'dialog:chooseFolder',
  libraryInit: 'library:init',
  libraryScan: 'library:scan',
  promptSave: 'prompt:save',
  promptMove: 'prompt:move',
  promptArchive: 'prompt:archive'
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

export interface PromptLibrarianApi {
  getRootPath(): Promise<string | null>
  setRootPath(p: string): Promise<void>
  chooseFolder(defaultPath?: string): Promise<string | null>
  initLibrary(rootPath: string): Promise<InitResult>
  scanLibrary(): Promise<Prompt[]>
  savePrompt(draft: PromptDraft, opts?: SaveOptions): Promise<SaveResult>
  movePrompt(currentRelPath: string, newFolder: string): Promise<MoveResult>
  archivePrompt(currentRelPath: string): Promise<MoveResult>
}
