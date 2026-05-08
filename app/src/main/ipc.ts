import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { ClassifierProvider } from '../shared/classifier'
import { IPC, ClassifyRequest, PromptDraft, SaveOptions } from '../shared/ipc'
import * as settings from './services/settings'
import * as library from './services/library'
import * as classifier from './services/classifier'
import * as rules from './services/rules/rulesService'
import * as secrets from './services/secrets'

const ENV_KEY = 'PROMPT_LIBRARIAN_GEMINI_API_KEY'

async function requireRoot(): Promise<string> {
  const root = await settings.getRootPath()
  if (!root) throw new Error('Library root is not set.')
  return root
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.settingsGetRootPath, async () => {
    return settings.getRootPath()
  })

  ipcMain.handle(IPC.settingsSetRootPath, async (_evt, rootPath: string) => {
    if (typeof rootPath !== 'string' || rootPath.length === 0) {
      throw new Error('rootPath must be a non-empty string')
    }
    await settings.setRootPath(rootPath)
  })

  ipcMain.handle(IPC.dialogChooseFolder, async (evt, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(evt.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Choose prompt library folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.libraryInit, async (_evt, rootPath: string) => {
    if (typeof rootPath !== 'string' || rootPath.length === 0) {
      throw new Error('rootPath must be a non-empty string')
    }
    return library.initLibrary(rootPath)
  })

  ipcMain.handle(IPC.libraryCheckRoot, async () => {
    return library.checkRoot()
  })

  ipcMain.handle(IPC.libraryScan, async () => {
    return library.scanLibrary()
  })

  ipcMain.handle(IPC.libraryListFolders, async () => {
    return library.listFolders()
  })

  ipcMain.handle(IPC.promptSave, async (_evt, draft: PromptDraft, opts?: SaveOptions) => {
    return library.savePrompt(draft, opts ?? {})
  })

  ipcMain.handle(IPC.promptMove, async (_evt, currentRelPath: string, newFolder: string) => {
    return library.movePrompt(currentRelPath, newFolder)
  })

  ipcMain.handle(IPC.promptArchive, async (_evt, currentRelPath: string) => {
    return library.archivePrompt(currentRelPath)
  })

  // ----- Classifier ---------------------------------------------------

  ipcMain.handle(IPC.classifierClassify, async (_evt, req: ClassifyRequest) => {
    return classifier.classify(req)
  })

  ipcMain.handle(IPC.classifierGetAiStatus, async () => {
    return classifier.getAiStatus()
  })

  // ----- Rules --------------------------------------------------------

  ipcMain.handle(IPC.rulesGet, async () => {
    const root = await requireRoot()
    const folders = await library.listFolders().catch(() => [] as string[])
    const loaded = await rules.loadRules(root, folders)
    return {
      rules: loaded.rules,
      validation: loaded.validation,
      usingDefaults: loaded.usingDefaults,
      path: loaded.path
    }
  })

  ipcMain.handle(IPC.rulesGetPath, async () => {
    const root = await settings.getRootPath()
    if (!root) return null
    return rules.rulesPath(root)
  })

  ipcMain.handle(IPC.rulesOpenInEditor, async () => {
    const root = await settings.getRootPath()
    if (!root) return { ok: false, error: 'Library root is not set.' }
    const path = rules.rulesPath(root)
    // Ensure it exists (seed if missing) so shell.openPath finds something.
    await rules.loadRules(root)
    const errMsg = await shell.openPath(path)
    if (errMsg) return { ok: false, error: errMsg }
    return { ok: true }
  })

  ipcMain.handle(IPC.rulesReset, async () => {
    const root = await requireRoot()
    return rules.resetRules(root)
  })

  ipcMain.handle(IPC.rulesReload, async () => {
    const root = await requireRoot()
    const folders = await library.listFolders().catch(() => [] as string[])
    const loaded = await rules.loadRules(root, folders)
    return {
      rules: loaded.rules,
      validation: loaded.validation,
      usingDefaults: loaded.usingDefaults,
      path: loaded.path
    }
  })

  // ----- Settings: classifier provider --------------------------------

  ipcMain.handle(IPC.settingsGetClassifierProvider, async () => {
    return settings.getClassifierProvider()
  })

  ipcMain.handle(IPC.settingsSetClassifierProvider, async (_evt, p: ClassifierProvider) => {
    if (p !== 'deterministic' && p !== 'gemini') {
      throw new Error('classifierProvider must be "deterministic" or "gemini"')
    }
    await settings.setClassifierProvider(p)
  })

  // ----- Settings: Gemini API key (stays in main, never returned) -----

  ipcMain.handle(IPC.settingsHasGeminiApiKey, async () => {
    if (process.env[ENV_KEY] && process.env[ENV_KEY]!.trim().length > 0) {
      return { has: true, source: 'env' as const }
    }
    const has = await secrets.hasStoredSecret()
    return { has, source: has ? ('stored' as const) : ('none' as const) }
  })

  ipcMain.handle(IPC.settingsSetGeminiApiKey, async (_evt, key: string) => {
    if (typeof key !== 'string') {
      return { ok: false, error: 'unknown' as const, message: 'Key must be a string.' }
    }
    const trimmed = key.trim()
    if (trimmed.length === 0) {
      return { ok: false, error: 'unknown' as const, message: 'Key is empty.' }
    }
    const result = await secrets.setSecret(trimmed)
    if (result.ok) return { ok: true as const }
    return {
      ok: false as const,
      error: result.reason,
      message: result.message
    }
  })

  ipcMain.handle(IPC.settingsClearGeminiApiKey, async () => {
    await secrets.clearSecret()
    return { ok: true as const }
  })
}
