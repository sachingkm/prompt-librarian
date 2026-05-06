import { promises as fs } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import matter from 'gray-matter'
import {
  ARCHIVE_FOLDER,
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
        ...fm
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

function stringifyPrompt(draft: PromptDraft): string {
  // gray-matter's stringify wraps in --- ... --- and a body
  const fm = { ...draft.frontmatter }
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

  const exists = await fs.stat(fileAbs).catch(() => null)
  if (exists && exists.isFile()) {
    if (strategy === 'fail') {
      return {
        ok: false,
        collision: true,
        path: fileAbs,
        relPath: toRelPosix(root, fileAbs),
        error: 'File already exists'
      }
    }
    // 'overwrite' or 'rename' (already remapped above) both proceed below
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

async function moveRelative(currentRelPath: string, newFolderRel: string): Promise<MoveResult> {
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

  const cleanedFolder = newFolderRel.replace(/^[/\\]+|[/\\]+$/g, '')
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

  // Refuse to clobber an existing file at destination
  const dstExists = await fs.stat(newAbs).catch(() => null)
  if (dstExists && dstExists.isFile()) {
    return { ok: false, error: `Destination already exists: ${toRelPosix(root, newAbs)}` }
  }

  try {
    await fs.rename(oldAbs, newAbs)
    return { ok: true, newRelPath: toRelPosix(root, newAbs) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function movePrompt(currentRelPath: string, newFolder: string): Promise<MoveResult> {
  return moveRelative(currentRelPath, newFolder)
}

export async function archivePrompt(currentRelPath: string): Promise<MoveResult> {
  return moveRelative(currentRelPath, ARCHIVE_FOLDER)
}

export function libraryRootPathSync(): string | null {
  // Convenience for diagnostic logging only
  return null
}

// Re-export for tests / diagnostics
export const _internal = { toPosix, toRelPosix }
