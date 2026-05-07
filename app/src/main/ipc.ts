import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, PromptDraft, SaveOptions } from '../shared/ipc'
import * as settings from './services/settings'
import * as library from './services/library'

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

  ipcMain.handle(
    IPC.promptSave,
    async (_evt, draft: PromptDraft, opts?: SaveOptions) => {
      return library.savePrompt(draft, opts ?? {})
    }
  )

  ipcMain.handle(IPC.promptMove, async (_evt, currentRelPath: string, newFolder: string) => {
    return library.movePrompt(currentRelPath, newFolder)
  })

  ipcMain.handle(IPC.promptArchive, async (_evt, currentRelPath: string) => {
    return library.archivePrompt(currentRelPath)
  })
}
