// Encrypted secret storage using Electron safeStorage.
//
// The Gemini API key is never sent to the renderer in cleartext. The
// renderer can only ask "is a key set?" / "set a key" / "clear the key".
// Reading the cleartext key happens in main, on the codepath that calls
// Gemini, and the value never crosses the IPC boundary again.
//
// On platforms where safeStorage is unavailable (rare; usually a
// misconfigured Linux session without DBus secret service), set() refuses
// rather than fall back to plaintext. The UI surfaces this as a clear
// "secret-storage-unavailable" error.

import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const SECRET_FILENAME = 'gemini-api-key.bin'

function secretFilePath(): string {
  return join(app.getPath('userData'), SECRET_FILENAME)
}

export function isSecretStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export async function hasStoredSecret(): Promise<boolean> {
  try {
    const stat = await fs.stat(secretFilePath())
    return stat.isFile() && stat.size > 0
  } catch {
    return false
  }
}

export async function readSecret(): Promise<string | null> {
  if (!isSecretStorageAvailable()) return null
  try {
    const buf = await fs.readFile(secretFilePath())
    if (buf.length === 0) return null
    const out = safeStorage.decryptString(buf)
    return out || null
  } catch {
    return null
  }
}

export async function setSecret(plaintext: string): Promise<{ ok: true } | { ok: false; reason: 'secret-storage-unavailable' | 'unknown'; message?: string }> {
  if (!isSecretStorageAvailable()) {
    return { ok: false, reason: 'secret-storage-unavailable' }
  }
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    return { ok: false, reason: 'unknown', message: 'Empty key.' }
  }
  try {
    const enc = safeStorage.encryptString(plaintext)
    const file = secretFilePath()
    await fs.mkdir(join(file, '..'), { recursive: true })
    await fs.writeFile(file, enc, { mode: 0o600 })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: 'unknown', message: (err as Error).message }
  }
}

export async function clearSecret(): Promise<void> {
  try {
    await fs.unlink(secretFilePath())
  } catch {
    // ignore: nothing to clear
  }
}
