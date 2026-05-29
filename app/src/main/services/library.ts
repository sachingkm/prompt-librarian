import { promises as fs } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import matter from 'gray-matter'
import {
  ARCHIVE_FOLDER,
  CheckRootResult,
  DEFAULT_LIBRARY_FOLDERS,
  InitResult,
  MoveResult,
  Prompt,
  PromptDraft,
  PromptFrontmatter,
  SaveOptions,
  SaveResult
} from '../../shared/ipc'
import { assertValidFilename, safeResolveWithin, toPosix, toRelPosix } from './paths'
import * as settings from './settings'

async function requireRoot(): Promise<string> {
  const root = await settings.getRootPath()
  if (!root) throw new Error('Library root path not set')
  // Verify it actually exists and is a directory
  const stat = await fs.stat(root).catch(() => null)
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Library root does not exist or is not a directory: ${root}`)
  }
  return root
}

// Cheap boot-time validity check. Used by the renderer to decide between
// onboarding and main shell without doing a full library scan.
export async function checkRoot(): Promise<CheckRootResult> {
  let rootPath: string | null = null
  try {
    rootPath = await settings.getRootPath()
    if (!rootPath) return { ok: false, rootPath: null, reason: 'unset' }
    const stat = await fs.stat(rootPath).catch(() => null)
    if (!stat) return { ok: false, rootPath, reason: 'missing' }
    if (!stat.isDirectory()) return { ok: false, rootPath, reason: 'not-directory' }
    return { ok: true, rootPath }
  } catch (err) {
    return {
      ok: false,
      rootPath,
      reason: 'error',
      error: (err as Error).message
    }
  }
}

export async function initLibrary(rootPath: string): Promise<InitResult> {
  const created: string[] = []
  const alreadyExisted: string[] = []
  const errors: string[] = []

  try {
    await fs.mkdir(rootPath, { recursive: true })
  } catch (err) {
    return {
      ok: false,
      rootPath,
      created,
      alreadyExisted,
      errors: [`Failed to create root: ${(err as Error).message}`]
    }
  }

  for (const rel of DEFAULT_LIBRARY_FOLDERS) {
    let abs: string
    try {
      abs = safeResolveWithin(rootPath, rel)
    } catch (err) {
      errors.push(`${rel}: ${(err as Error).message}`)
      continue
    }
    const existed = await fs.stat(abs).catch(() => null)
    if (existed && existed.isDirectory()) {
      alreadyExisted.push(rel)
      continue
    }
    try {
      await fs.mkdir(abs, { recursive: true })
      created.push(rel)
    } catch (err) {
      errors.push(`${rel}: ${(err as Error).message}`)
    }
  }

  return { ok: errors.length === 0, rootPath, created, alreadyExisted, errors }
}

// Walk subdirectories (depth-first) under root and report relative folder
// paths in POSIX form. Skips dot-prefixed dirs (.git, .prompt-librarian,
// etc.) so app metadata never leaks into folder choices.
async function* walkFolders(dir: string, root: string): AsyncGenerator<string> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    const rel = toRelPosix(root, full)
    yield rel
    yield* walkFolders(full, root)
  }
}

// Listed for the classifier (not for general renderer use). Pure folder
// names, no prompt contents read. Defers to the saved root.
export async function listFolders(): Promise<string[]> {
  const root = await requireRoot()
  const out: string[] = []
  for await (const f of walkFolders(root, root)) out.push(f)
  out.sort()
  return out
}

async function* walkMarkdown(dir: string, root: string): AsyncGenerator<string> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip hidden / system dirs
      if (entry.name.startsWith('.')) continue
      yield* walkMarkdown(full, root)
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      yield full
    }
  }
}

// js-yaml (used by gray-matter) auto-parses ISO timestamp strings into Date
// objects when the YAML schema sees them. The IPC contract declares
// `created_at` and `updated_at` as strings, so coerce here at the boundary.
// Anything else (numbers, etc.) is stringified rather than dropped.
function normalizeDateField(v: unknown): string | undefined {
  if (v == null) return undefined
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? undefined : v.toISOString()
  }
  if (typeof v === 'string') return v
  return String(v)
}

export async function scanLibrary(): Promise<Prompt[]> {
  const root = await requireRoot()
  const out: Prompt[] = []
  for await (const abs of walkMarkdown(root, root)) {
    try {
      const raw = await fs.readFile(abs, 'utf8')
      const parsed = matter(raw)
      const fm = (parsed.data ?? {}) as Partial<PromptFrontmatter>
      const filename = basename(abs)
      const folder = toRelPosix(root, dirname(abs))
      const relPath = toRelPosix(root, abs)
      const frontmatter: PromptFrontmatter = {
        title: typeof fm.title === 'string' ? fm.title : filename.replace(/\.md$/i, ''),
        ...fm,
        created_at: normalizeDateField(fm.created_at),
        updated_at: normalizeDateField(fm.updated_at)
      }
      out.push({
        relPath,
        folder: folder === '' ? '.' : folder,
        filename,
        frontmatter,
        body: parsed.content ?? ''
      })
    } catch {
      // Skip unreadable files; do not silently mutate
    }
  }
  // Sort for deterministic output
  out.sort((a, b) => a.relPath.localeCompare(b.relPath))
  return out
}

export function stringifyPrompt(draft: PromptDraft): string {
  // gray-matter's stringify wraps in --- ... --- and a body
  const fm = Object.fromEntries(
    Object.entries(draft.frontmatter).filter(([, value]) => value !== undefined)
  )
  return matter.stringify(draft.body ?? '', fm)
}

export async function savePrompt(
  draft: PromptDraft,
  opts: SaveOptions = {}
): Promise<SaveResult> {
  const strategy = opts.strategy ?? 'fail'
  const root = await requireRoot()

  let filename = draft.filename
  if (strategy === 'rename') {
    if (!opts.newFilename) {
      return { ok: false, error: "strategy 'rename' requires opts.newFilename" }
    }
    filename = opts.newFilename
  }

  try {
    assertValidFilename(filename)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  const folderRel = draft.folder.replace(/^[/\\]+|[/\\]+$/g, '')
  let folderAbs: string
  let fileAbs: string
  try {
    folderAbs = safeResolveWithin(root, folderRel)
    fileAbs = safeResolveWithin(root, join(folderRel, filename))
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  await fs.mkdir(folderAbs, { recursive: true })

  // Collision: only 'overwrite' is allowed to clobber an existing file.
  // 'fail' and 'rename' both refuse to overwrite. For 'rename' this means the
  // caller-supplied newFilename must itself be unused, otherwise we surface
  // the collision instead of silently writing over it.
  const exists = await fs.stat(fileAbs).catch(() => null)
  if (exists && exists.isFile() && strategy !== 'overwrite') {
    return {
      ok: false,
      collision: true,
      path: fileAbs,
      relPath: toRelPosix(root, fileAbs),
      error:
        strategy === 'rename'
          ? `Renamed target already exists: ${filename}`
          : 'File already exists'
    }
  }

  try {
    const contents = stringifyPrompt({ ...draft, filename })
    await fs.writeFile(fileAbs, contents, 'utf8')
    return {
      ok: true,
      path: fileAbs,
      relPath: toRelPosix(root, fileAbs)
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// Edit an existing prompt. Unlike savePrompt (which always creates a new
// file), this updates a known prompt in place, and relocates it when the
// edited folder/filename change its path.
//
// - Same path (folder + filename unchanged): overwrite in place. This is an
//   intentional edit of the same prompt, so no collision is raised.
// - New path: write the new file, then remove the original. A DIFFERENT
//   existing file at the new path is a guarded collision (fail unless the
//   caller passes strategy 'overwrite', or 'rename' with a fresh filename).
//
// Write-then-delete order means a failed delete leaves a duplicate rather
// than losing data. updated_at is the caller's responsibility (the renderer
// sets it), matching savePrompt.
export async function updatePrompt(
  originalRelPath: string,
  draft: PromptDraft,
  opts: SaveOptions = {}
): Promise<SaveResult> {
  const strategy = opts.strategy ?? 'fail'
  const root = await requireRoot()

  let oldAbs: string
  try {
    oldAbs = safeResolveWithin(root, originalRelPath)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
  const oldStat = await fs.stat(oldAbs).catch(() => null)
  if (!oldStat || !oldStat.isFile()) {
    return { ok: false, error: `Original prompt not found: ${originalRelPath}` }
  }

  let filename = draft.filename
  if (strategy === 'rename') {
    if (!opts.newFilename) {
      return { ok: false, error: "strategy 'rename' requires opts.newFilename" }
    }
    filename = opts.newFilename
  }
  try {
    assertValidFilename(filename)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  const folderRel = draft.folder.replace(/^[/\\]+|[/\\]+$/g, '')
  let folderAbs: string
  let newAbs: string
  try {
    folderAbs = safeResolveWithin(root, folderRel)
    newAbs = safeResolveWithin(root, join(folderRel, filename))
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  const relocating = newAbs !== oldAbs

  await fs.mkdir(folderAbs, { recursive: true })

  if (relocating) {
    const dstExists = await fs.stat(newAbs).catch(() => null)
    if (dstExists && dstExists.isFile() && strategy !== 'overwrite') {
      return {
        ok: false,
        collision: true,
        path: newAbs,
        relPath: toRelPosix(root, newAbs),
        error:
          strategy === 'rename'
            ? `Renamed target already exists: ${filename}`
            : 'A different prompt already exists at the new location.'
      }
    }
  }

  try {
    const contents = stringifyPrompt({ ...draft, filename })
    await fs.writeFile(newAbs, contents, 'utf8')
    if (relocating) {
      // Remove the original only after the new file is safely written.
      await fs.rm(oldAbs, { force: true })
    }
    return { ok: true, path: newAbs, relPath: toRelPosix(root, newAbs) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function movePrompt(
  currentRelPath: string,
  newFolder: string
): Promise<MoveResult> {
  const root = await requireRoot()
  let oldAbs: string
  try {
    oldAbs = safeResolveWithin(root, currentRelPath)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
  const stat = await fs.stat(oldAbs).catch(() => null)
  if (!stat || !stat.isFile()) {
    return { ok: false, error: `Source file not found: ${currentRelPath}` }
  }

  const filename = basename(oldAbs)
  try {
    assertValidFilename(filename)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  const cleanedFolder = newFolder.replace(/^[/\\]+|[/\\]+$/g, '')
  let newFolderAbs: string
  let newAbs: string
  try {
    newFolderAbs = safeResolveWithin(root, cleanedFolder)
    newAbs = safeResolveWithin(root, join(cleanedFolder, filename))
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  if (oldAbs === newAbs) {
    return { ok: true, newRelPath: toRelPosix(root, newAbs) }
  }

  await fs.mkdir(newFolderAbs, { recursive: true })

  // Move never overwrites. If a file already exists at the destination, flag
  // the collision and let the caller decide what to do.
  const dstExists = await fs.stat(newAbs).catch(() => null)
  if (dstExists && dstExists.isFile()) {
    return {
      ok: false,
      collision: true,
      newRelPath: toRelPosix(root, newAbs),
      error: `Destination already exists: ${toRelPosix(root, newAbs)}`
    }
  }

  try {
    await fs.rename(oldAbs, newAbs)
    return { ok: true, newRelPath: toRelPosix(root, newAbs) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

function timestampSuffix(d: Date = new Date()): string {
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0')
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

function appendBeforeExt(filename: string, suffix: string): string {
  const ext = extname(filename)
  const base = ext ? filename.slice(0, -ext.length) : filename
  return `${base}.${suffix}${ext}`
}

// Archive auto-renames on collision instead of failing or overwriting. The
// existing archived file is left untouched; the incoming file is renamed with
// a timestamp suffix. If two archives collide within the same second, a
// numeric counter is appended to keep both files.
export async function archivePrompt(currentRelPath: string): Promise<MoveResult> {
  const root = await requireRoot()
  let oldAbs: string
  try {
    oldAbs = safeResolveWithin(root, currentRelPath)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
  const stat = await fs.stat(oldAbs).catch(() => null)
  if (!stat || !stat.isFile()) {
    return { ok: false, error: `Source file not found: ${currentRelPath}` }
  }

  const filename = basename(oldAbs)
  try {
    assertValidFilename(filename)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  let archiveFolderAbs: string
  let archiveTargetAbs: string
  try {
    archiveFolderAbs = safeResolveWithin(root, ARCHIVE_FOLDER)
    archiveTargetAbs = safeResolveWithin(root, join(ARCHIVE_FOLDER, filename))
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  // No-op if already at the archive location.
  if (oldAbs === archiveTargetAbs) {
    return { ok: true, newRelPath: toRelPosix(root, archiveTargetAbs) }
  }

  await fs.mkdir(archiveFolderAbs, { recursive: true })

  let finalAbs: string | null = null
  let autoRenamed = false

  const targetExists = await fs.stat(archiveTargetAbs).catch(() => null)
  if (!targetExists) {
    finalAbs = archiveTargetAbs
  } else {
    autoRenamed = true
    const ts = timestampSuffix()
    // Try in order: <name>.<ts>.<ext>, <name>.<ts>-1.<ext>, <name>.<ts>-2.<ext>, ...
    // Cap defensively so a hostile or pathological archive directory cannot
    // wedge the loop. In normal use the first or second candidate is free.
    const MAX_ATTEMPTS = 1000
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const suffix = i === 0 ? ts : `${ts}-${i}`
      let candidate: string
      try {
        candidate = safeResolveWithin(
          root,
          join(ARCHIVE_FOLDER, appendBeforeExt(filename, suffix))
        )
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
      const candStat = await fs.stat(candidate).catch(() => null)
      if (!candStat) {
        finalAbs = candidate
        break
      }
    }
    if (!finalAbs) {
      // Defensive: hand back a clear error rather than overwrite. Should be
      // unreachable outside truly pathological archive states.
      return {
        ok: false,
        collision: true,
        error: 'Could not find a free archive filename'
      }
    }
  }

  // finalAbs is now confirmed free (or was never occupied). Only rename now.
  try {
    await fs.rename(oldAbs, finalAbs)
    const result: MoveResult = { ok: true, newRelPath: toRelPosix(root, finalAbs) }
    if (autoRenamed) result.autoRenamed = true
    return result
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// Re-export for tests / diagnostics
export const _internal = { toPosix, toRelPosix, timestampSuffix, appendBeforeExt }
