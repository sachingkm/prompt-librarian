import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ClassifierProvider } from '../shared/classifier'
import {
  AppendCorrectionPayload,
  IPC,
  ClassifyRequest,
  PromptDraft,
  SaveOptions,
  LearningSettings
} from '../shared/ipc'
import type { ClassifierRules } from '../shared/classifierRules'
import * as settings from './services/settings'
import * as library from './services/library'
import * as classifier from './services/classifier'
import * as rules from './services/rules/rulesService'
import * as secrets from './services/secrets'
import * as corrections from './services/corrections'
import * as proposals from './services/proposals'
import { validateClassifierRules } from '../shared/classifierRules'
import { applyProposalToRules } from './services/proposals'

const ENV_KEY = 'PROMPT_LIBRARIAN_GEMINI_API_KEY'

async function requireRoot(): Promise<string> {
  const root = await settings.getRootPath()
  if (!root) throw new Error('Library root is not set.')
  return root
}

async function loadRulesPayload(root: string): Promise<{
  rules: ClassifierRules
  validation: ReturnType<typeof validateClassifierRules>
  usingDefaults: boolean
  path: string
}> {
  const folders = await library.listFolders().catch(() => [] as string[])
  const loaded = await rules.loadRules(root, folders)
  return {
    rules: loaded.rules,
    validation: loaded.validation,
    usingDefaults: loaded.usingDefaults,
    path: loaded.path
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.settingsGetRootPath, async () => settings.getRootPath())

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

  ipcMain.handle(IPC.libraryCheckRoot, async () => library.checkRoot())
  ipcMain.handle(IPC.libraryScan, async () => library.scanLibrary())
  ipcMain.handle(IPC.libraryListFolders, async () => library.listFolders())

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

  ipcMain.handle(IPC.classifierGetAiStatus, async () => classifier.getAiStatus())

  // ----- Rules --------------------------------------------------------

  ipcMain.handle(IPC.rulesGet, async () => {
    const root = await requireRoot()
    return loadRulesPayload(root)
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
    return loadRulesPayload(root)
  })

  ipcMain.handle(IPC.rulesWrite, async (_evt, candidate: ClassifierRules) => {
    const root = await requireRoot()
    const folders = await library.listFolders().catch(() => [] as string[])
    const loaded = await rules.writeRules(root, candidate, folders)
    return {
      rules: loaded.rules,
      validation: loaded.validation,
      usingDefaults: loaded.usingDefaults,
      path: loaded.path
    }
  })

  ipcMain.handle(IPC.rulesExport, async (evt) => {
    const root = await requireRoot()
    const win = BrowserWindow.fromWebContents(evt.sender) ?? undefined
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export rules.json',
      defaultPath: 'rules.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    const loaded = await rules.loadRules(root)
    try {
      await fs.writeFile(result.filePath, JSON.stringify(loaded.rules, null, 2) + '\n', 'utf8')
      return { ok: true, path: result.filePath }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IPC.rulesImport, async (evt) => {
    const root = await requireRoot()
    const win = BrowserWindow.fromWebContents(evt.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import rules.json',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false }
    try {
      const raw = await fs.readFile(result.filePaths[0], 'utf8')
      const parsed = JSON.parse(raw) as ClassifierRules
      const folders = await library.listFolders().catch(() => [] as string[])
      const written = await rules.writeRules(root, parsed, folders)
      if (!written.validation.ok) {
        return {
          ok: false,
          error: written.validation.errors.map((e) => `${e.path || '/'}: ${e.message}`).join('; ')
        }
      }
      return { ok: true, rules: written }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // ----- Settings: classifier provider --------------------------------

  ipcMain.handle(IPC.settingsGetClassifierProvider, async () => settings.getClassifierProvider())

  ipcMain.handle(
    IPC.settingsSetClassifierProvider,
    async (_evt, p: ClassifierProvider | 'auto') => {
      if (p === 'auto') {
        await settings.setManualClassifierProvider(null)
        return
      }
      if (p !== 'deterministic' && p !== 'gemini') {
        throw new Error('classifierProvider must be "deterministic", "gemini", or "auto"')
      }
      await settings.setClassifierProvider(p)
    }
  )

  // ----- Settings: Gemini API key -------------------------------------

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
    return { ok: false as const, error: result.reason, message: result.message }
  })

  ipcMain.handle(IPC.settingsClearGeminiApiKey, async () => {
    await secrets.clearSecret()
    return { ok: true as const }
  })

  // ----- Corrections (Phase 4B) ---------------------------------------

  ipcMain.handle(IPC.correctionsAppend, async (_evt, payload: AppendCorrectionPayload) => {
    const root = await requireRoot()
    const correction = corrections.buildCorrection({
      rawText: payload.rawText,
      classifierId: payload.classifierId,
      provider: payload.provider,
      suggested: corrections.sanitizeMetadata(payload.suggested),
      accepted: corrections.sanitizeMetadata(payload.accepted),
      matchedKeywords: payload.matchedKeywords,
      matchedTriggers: payload.matchedTriggers
    })
    if (!correction) return { ok: true }
    await corrections.appendCorrection(root, correction)
    // After every correction, run the pattern detector if suggestions are on.
    if (await settings.getSuggestRuleAdditions()) {
      const folders = await library.listFolders().catch(() => [] as string[])
      const loaded = await rules.loadRules(root, folders)
      const all = await corrections.loadCorrections(root)
      const result = await proposals.analyzeAndPersist(root, all.corrections, loaded.rules)
      return { ok: true, created: result.created }
    }
    return { ok: true }
  })

  ipcMain.handle(IPC.correctionsList, async () => {
    const root = await requireRoot()
    return corrections.loadCorrections(root)
  })

  ipcMain.handle(IPC.correctionsCount, async () => {
    const root = await requireRoot()
    const loaded = await corrections.loadCorrections(root)
    return loaded.corrections.length
  })

  ipcMain.handle(IPC.correctionsClear, async () => {
    const root = await requireRoot()
    await corrections.clearCorrections(root)
    return { ok: true as const }
  })

  // ----- Proposals (Phase 4B) -----------------------------------------

  ipcMain.handle(IPC.proposalsList, async () => {
    const root = await requireRoot()
    const store = await proposals.loadStore(root)
    return { proposals: store.proposals }
  })

  ipcMain.handle(IPC.proposalsAccept, async (_evt, id: string) => {
    const root = await requireRoot()
    const proposal = await proposals.setProposalStatus(root, id, 'accepted')
    if (!proposal) return { ok: false, error: 'Proposal not found' }
    const folders = await library.listFolders().catch(() => [] as string[])
    const loaded = await rules.loadRules(root, folders)
    const next = applyProposalToRules(loaded.rules, proposal)
    const written = await rules.writeRules(root, next, folders)
    if (!written.validation.ok) {
      return {
        ok: false,
        error: written.validation.errors.map((e) => `${e.path || '/'}: ${e.message}`).join('; ')
      }
    }
    return { ok: true, rules: written }
  })

  ipcMain.handle(IPC.proposalsReject, async (_evt, id: string) => {
    const root = await requireRoot()
    await proposals.setProposalStatus(root, id, 'rejected')
    return { ok: true as const }
  })

  ipcMain.handle(IPC.proposalsAnalyze, async () => {
    const root = await requireRoot()
    const folders = await library.listFolders().catch(() => [] as string[])
    const loaded = await rules.loadRules(root, folders)
    const all = await corrections.loadCorrections(root)
    const result = await proposals.analyzeAndPersist(root, all.corrections, loaded.rules)
    return { created: result.created }
  })

  // ----- Learning settings -------------------------------------------

  ipcMain.handle(IPC.learningGetSettings, async () => {
    const root = await settings.getRootPath()
    let correctionCount = 0
    let pendingProposalCount = 0
    if (root) {
      try {
        const c = await corrections.loadCorrections(root)
        correctionCount = c.corrections.length
        const s = await proposals.loadStore(root)
        pendingProposalCount = s.proposals.filter((p) => p.status === 'pending').length
      } catch {
        // ignore - learning UI tolerates failures
      }
    }
    const out: LearningSettings = {
      useCorrectionsAsExamples: await settings.getUseCorrectionsAsExamples(),
      suggestRuleAdditions: await settings.getSuggestRuleAdditions(),
      correctionCount,
      pendingProposalCount
    }
    return out
  })

  ipcMain.handle(IPC.learningSetSettings, async (_evt, partial: Partial<LearningSettings>) => {
    if (typeof partial.useCorrectionsAsExamples === 'boolean') {
      await settings.setUseCorrectionsAsExamples(partial.useCorrectionsAsExamples)
    }
    if (typeof partial.suggestRuleAdditions === 'boolean') {
      await settings.setSuggestRuleAdditions(partial.suggestRuleAdditions)
    }
    // Re-read aggregated to return.
    const root = await settings.getRootPath()
    let correctionCount = 0
    let pendingProposalCount = 0
    if (root) {
      try {
        correctionCount = (await corrections.loadCorrections(root)).corrections.length
        pendingProposalCount = (await proposals.loadStore(root)).proposals.filter(
          (p) => p.status === 'pending'
        ).length
      } catch { /* ignore */ }
    }
    return {
      useCorrectionsAsExamples: await settings.getUseCorrectionsAsExamples(),
      suggestRuleAdditions: await settings.getSuggestRuleAdditions(),
      correctionCount,
      pendingProposalCount
    }
  })

  ipcMain.handle(IPC.learningOpenFolder, async () => {
    const root = await settings.getRootPath()
    if (!root) return { ok: false, error: 'Library root is not set.' }
    const folder = join(root, '.prompt-librarian')
    await fs.mkdir(folder, { recursive: true })
    const errMsg = await shell.openPath(folder)
    if (errMsg) return { ok: false, error: errMsg }
    return { ok: true }
  })
}
