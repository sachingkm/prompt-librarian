import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ClassifierProvider } from '../../shared/classifier'

interface SettingsShape {
  rootPath?: string | null
  // Phase 4B renamed from classifierProvider to manualClassifierProvider
  // to make it explicit that this is a USER OVERRIDE. Absent = AI-default
  // (Gemini if key, deterministic otherwise). The legacy key is read once
  // for backward compatibility.
  classifierProvider?: ClassifierProvider // legacy
  manualClassifierProvider?: ClassifierProvider | null
  useCorrectionsAsExamples?: boolean
  suggestRuleAdditions?: boolean
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

// Phase 4A compat: returns the EFFECTIVE provider as if there was always a
// manual choice. Phase 4B prefers getManualClassifierProvider + getAiStatus.
export async function getClassifierProvider(): Promise<ClassifierProvider> {
  const m = await getManualClassifierProvider()
  if (m) return m
  return 'deterministic'
}

export async function setClassifierProvider(p: ClassifierProvider): Promise<void> {
  // Setting through this entrypoint is treated as a manual override.
  await setManualClassifierProvider(p)
}

export async function getManualClassifierProvider(): Promise<ClassifierProvider | null> {
  const s = await readSettings()
  if (s.manualClassifierProvider === 'deterministic' || s.manualClassifierProvider === 'gemini') {
    return s.manualClassifierProvider
  }
  // Honour the legacy key once.
  if (s.classifierProvider === 'gemini') return 'gemini'
  if (s.classifierProvider === 'deterministic') return 'deterministic'
  return null
}

export async function setManualClassifierProvider(
  p: ClassifierProvider | null
): Promise<void> {
  const s = await readSettings()
  s.manualClassifierProvider = p
  // Clear legacy key so future reads are unambiguous.
  if ('classifierProvider' in s) delete (s as { classifierProvider?: ClassifierProvider }).classifierProvider
  await writeSettings(s)
}

export async function getUseCorrectionsAsExamples(): Promise<boolean> {
  const s = await readSettings()
  return s.useCorrectionsAsExamples !== false // default ON
}

export async function setUseCorrectionsAsExamples(v: boolean): Promise<void> {
  const s = await readSettings()
  s.useCorrectionsAsExamples = v
  await writeSettings(s)
}

export async function getSuggestRuleAdditions(): Promise<boolean> {
  const s = await readSettings()
  return s.suggestRuleAdditions !== false // default ON
}

export async function setSuggestRuleAdditions(v: boolean): Promise<void> {
  const s = await readSettings()
  s.suggestRuleAdditions = v
  await writeSettings(s)
}
