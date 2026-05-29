import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ClassifierProvider } from '../shared/classifier'
import type { ClassifierRules } from '../shared/classifierRules'
import {
  AiStatus,
  AppendCorrectionPayload,
  CheckRootResult,
  ClassifyRequest,
  ClassifyResponse,
  ExportRulesResponse,
  IPC,
  ImportRulesResponse,
  InitResult,
  LearningSettings,
  MoveResult,
  Prompt,
  PromptDraft,
  PromptLibrarianApi,
  RulesPayload,
  RulesResetResponse,
  SaveOptions,
  SaveResult,
  SecretSetResponse
} from '../shared/ipc'
import type { Correction } from '../shared/correction'
import type { RuleProposal } from '../shared/proposal'
import type { DuplicateMatch } from '../shared/dedup'

const api: PromptLibrarianApi = {
  getRootPath: () => ipcRenderer.invoke(IPC.settingsGetRootPath) as Promise<string | null>,
  setRootPath: (p) => ipcRenderer.invoke(IPC.settingsSetRootPath, p) as Promise<void>,
  chooseFolder: (defaultPath) =>
    ipcRenderer.invoke(IPC.dialogChooseFolder, defaultPath) as Promise<string | null>,
  initLibrary: (rootPath) =>
    ipcRenderer.invoke(IPC.libraryInit, rootPath) as Promise<InitResult>,
  checkRoot: () => ipcRenderer.invoke(IPC.libraryCheckRoot) as Promise<CheckRootResult>,
  scanLibrary: () => ipcRenderer.invoke(IPC.libraryScan) as Promise<Prompt[]>,
  listFolders: () => ipcRenderer.invoke(IPC.libraryListFolders) as Promise<string[]>,
  savePrompt: (draft: PromptDraft, opts?: SaveOptions) =>
    ipcRenderer.invoke(IPC.promptSave, draft, opts) as Promise<SaveResult>,
  movePrompt: (currentRelPath, newFolder) =>
    ipcRenderer.invoke(IPC.promptMove, currentRelPath, newFolder) as Promise<MoveResult>,
  archivePrompt: (currentRelPath) =>
    ipcRenderer.invoke(IPC.promptArchive, currentRelPath) as Promise<MoveResult>,
  classify: (req: ClassifyRequest) =>
    ipcRenderer.invoke(IPC.classifierClassify, req) as Promise<ClassifyResponse>,
  checkDuplicate: (rawText: string) =>
    ipcRenderer.invoke(IPC.dedupCheck, rawText) as Promise<DuplicateMatch[]>,
  getAiStatus: () => ipcRenderer.invoke(IPC.classifierGetAiStatus) as Promise<AiStatus>,
  getRules: () => ipcRenderer.invoke(IPC.rulesGet) as Promise<RulesPayload>,
  getRulesPath: () => ipcRenderer.invoke(IPC.rulesGetPath) as Promise<string | null>,
  openRulesInEditor: () =>
    ipcRenderer.invoke(IPC.rulesOpenInEditor) as Promise<{ ok: boolean; error?: string }>,
  resetRules: () => ipcRenderer.invoke(IPC.rulesReset) as Promise<RulesResetResponse>,
  reloadRules: () => ipcRenderer.invoke(IPC.rulesReload) as Promise<RulesPayload>,
  writeRules: (rules: ClassifierRules) =>
    ipcRenderer.invoke(IPC.rulesWrite, rules) as Promise<RulesPayload>,
  exportRules: () => ipcRenderer.invoke(IPC.rulesExport) as Promise<ExportRulesResponse>,
  importRules: () => ipcRenderer.invoke(IPC.rulesImport) as Promise<ImportRulesResponse>,
  getClassifierProvider: () =>
    ipcRenderer.invoke(IPC.settingsGetClassifierProvider) as Promise<ClassifierProvider>,
  setClassifierProvider: (p: ClassifierProvider | 'auto') =>
    ipcRenderer.invoke(IPC.settingsSetClassifierProvider, p) as Promise<void>,
  hasGeminiApiKey: () =>
    ipcRenderer.invoke(IPC.settingsHasGeminiApiKey) as Promise<{
      has: boolean
      source: 'env' | 'stored' | 'none'
    }>,
  setGeminiApiKey: (key: string) =>
    ipcRenderer.invoke(IPC.settingsSetGeminiApiKey, key) as Promise<SecretSetResponse>,
  clearGeminiApiKey: () =>
    ipcRenderer.invoke(IPC.settingsClearGeminiApiKey) as Promise<{ ok: boolean }>,
  appendCorrection: (payload: AppendCorrectionPayload) =>
    ipcRenderer.invoke(IPC.correctionsAppend, payload) as Promise<{
      ok: boolean
      created?: RuleProposal[]
    }>,
  listCorrections: () =>
    ipcRenderer.invoke(IPC.correctionsList) as Promise<{
      corrections: Correction[]
      malformedLineCount: number
    }>,
  countCorrections: () => ipcRenderer.invoke(IPC.correctionsCount) as Promise<number>,
  clearCorrections: () =>
    ipcRenderer.invoke(IPC.correctionsClear) as Promise<{ ok: boolean }>,
  listProposals: () =>
    ipcRenderer.invoke(IPC.proposalsList) as Promise<{ proposals: RuleProposal[] }>,
  acceptProposal: (id: string) =>
    ipcRenderer.invoke(IPC.proposalsAccept, id) as Promise<{
      ok: boolean
      rules?: RulesPayload
      error?: string
    }>,
  rejectProposal: (id: string) =>
    ipcRenderer.invoke(IPC.proposalsReject, id) as Promise<{ ok: boolean }>,
  analyzeCorrections: () =>
    ipcRenderer.invoke(IPC.proposalsAnalyze) as Promise<{ created: RuleProposal[] }>,
  getLearningSettings: () =>
    ipcRenderer.invoke(IPC.learningGetSettings) as Promise<LearningSettings>,
  setLearningSettings: (s: Partial<LearningSettings>) =>
    ipcRenderer.invoke(IPC.learningSetSettings, s) as Promise<LearningSettings>,
  openLearningFolder: () =>
    ipcRenderer.invoke(IPC.learningOpenFolder) as Promise<{ ok: boolean; error?: string }>
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
