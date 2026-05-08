import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ClassifierProvider } from '../../shared/classifier'

interface SettingsShape {
  rootPath?: string | null
  classifierProvider?: ClassifierProvider
}

const SETTINGS_FILENAME = 'settings.json'

function settingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILENAME)
}

async function readSettings(): Promise<SettingsShape> {
  try {
    const raw = await fs.readFile(settingsFilePath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as SettingsShape
    return {}
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') return {}
    throw err
  }
}

async function writeSettings(s: SettingsShape): Promise<void> {
  const file = settingsFilePath()
  await fs.mkdir(join(file, '..'), { recursive: true })
  await fs.writeFile(file, JSON.stringify(s, null, 2), 'utf8')
}

export async function getRootPath(): Promise<string | null> {
  const s = await readSettings()
  return s.rootPath ?? null
}

export async function setRootPath(p: string | null): Promise<void> {
  const s = await readSettings()
  s.rootPath = p
  await writeSettings(s)
}

export async function getClassifierProvider(): Promise<ClassifierProvider> {
  const s = await readSettings()
  // Default = deterministic so the app works offline out of the box.
  return s.classifierProvider === 'gemini' ? 'gemini' : 'deterministic'
}

export async function setClassifierProvider(p: ClassifierProvider): Promise<void> {
  const s = await readSettings()
  s.classifierProvider = p
  await writeSettings(s)
}
