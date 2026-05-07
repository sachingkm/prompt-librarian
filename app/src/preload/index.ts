import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  CheckRootResult,
  IPC,
  InitResult,
  MoveResult,
  Prompt,
  PromptDraft,
  PromptLibrarianApi,
  SaveOptions,
  SaveResult
} from '../shared/ipc'

const api: PromptLibrarianApi = {
  getRootPath: () => ipcRenderer.invoke(IPC.settingsGetRootPath) as Promise<string | null>,
  setRootPath: (p) => ipcRenderer.invoke(IPC.settingsSetRootPath, p) as Promise<void>,
  chooseFolder: (defaultPath) =>
    ipcRenderer.invoke(IPC.dialogChooseFolder, defaultPath) as Promise<string | null>,
  initLibrary: (rootPath) =>
    ipcRenderer.invoke(IPC.libraryInit, rootPath) as Promise<InitResult>,
  checkRoot: () => ipcRenderer.invoke(IPC.libraryCheckRoot) as Promise<CheckRootResult>,
  scanLibrary: () => ipcRenderer.invoke(IPC.libraryScan) as Promise<Prompt[]>,
  savePrompt: (draft: PromptDraft, opts?: SaveOptions) =>
    ipcRenderer.invoke(IPC.promptSave, draft, opts) as Promise<SaveResult>,
  movePrompt: (currentRelPath, newFolder) =>
    ipcRenderer.invoke(IPC.promptMove, currentRelPath, newFolder) as Promise<MoveResult>,
  archivePrompt: (currentRelPath) =>
    ipcRenderer.invoke(IPC.promptArchive, currentRelPath) as Promise<MoveResult>
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
