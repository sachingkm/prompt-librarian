import type { Prompt } from '../../../shared/ipc'
import type { FolderNode } from './types'

const ARCHIVE_PREFIX = '99-Archive'

// Title fallback: prefer explicit frontmatter title, otherwise the filename
// without its extension. Internal comparisons use POSIX paths; this is for
// UI display only.
export function displayTitle(p: Prompt): string {
  return p.frontmatter.title || p.filename.replace(/\.md$/i, '')
}

// "Did the user actually set a title?" Heuristic: a prompt whose frontmatter
// title equals the filename-sans-extension is treated as missing - either
// because library:scan filled in the fallback, or because the user set a
// title that adds nothing. Either way it's a hygiene candidate.
export function hasExplicitTitle(p: Prompt): boolean {
  const fallback = p.filename.replace(/\.md$/i, '')
  return Boolean(p.frontmatter.title) && p.frontmatter.title !== fallback
}

// Hygiene means the prompt is missing one or more of: explicit title,
// category, tags, or reuse level. Used to power the Hygiene view and the
// "needs metadata" count.
export function isHygiene(p: Prompt): boolean {
  if (!hasExplicitTitle(p)) return true
  if (!p.frontmatter.category) return true
  if (!p.frontmatter.tags || p.frontmatter.tags.length === 0) return true
  if (!p.frontmatter.reuse) return true
  return false
}

export function isArchive(p: Prompt): boolean {
  return p.folder === ARCHIVE_PREFIX || p.folder.startsWith(ARCHIVE_PREFIX + '/')
}

// Recent sort: updated_at DESC, then created_at DESC, then filename ASC.
// Missing dates sort last because '' < any real ISO string.
export function recentSort(a: Prompt, b: Prompt): number {
  const ka = a.frontmatter.updated_at || a.frontmatter.created_at || ''
  const kb = b.frontmatter.updated_at || b.frontmatter.created_at || ''
  if (ka !== kb) return kb.localeCompare(ka)
  return a.filename.localeCompare(b.filename)
}

// Build a folder tree from the prompts' POSIX folder paths. Folders that
// contain no prompts (directly or transitively) are not represented - the
// scan only reports prompts, so empty folders are invisible. That is fine
// for v1.
export function buildFolderTree(prompts: Prompt[]): FolderNode[] {
  const ownByPath = new Map<string, number>()
  const totalByPath = new Map<string, number>()

  for (const p of prompts) {
    const folder = p.folder === '.' ? '' : p.folder
    ownByPath.set(folder, (ownByPath.get(folder) || 0) + 1)
    if (folder === '') {
      totalByPath.set('', (totalByPath.get('') || 0) + 1)
      continue
    }
    const parts = folder.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/')
      totalByPath.set(ancestor, (totalByPath.get(ancestor) || 0) + 1)
    }
  }

  function buildChildren(parentPath: string): FolderNode[] {
    const children: FolderNode[] = []
    const seen = new Set<string>()
    for (const path of totalByPath.keys()) {
      if (path === '') continue
      if (seen.has(path)) continue
      const parts = path.split('/')
      const parent = parts.length === 1 ? '' : parts.slice(0, -1).join('/')
      if (parent !== parentPath) continue
      seen.add(path)
      children.push({
        name: parts[parts.length - 1],
        path,
        count: totalByPath.get(path) || 0,
        ownCount: ownByPath.get(path) || 0,
        children: buildChildren(path)
      })
    }
    children.sort((a, b) => a.name.localeCompare(b.name))
    return children
  }

  return buildChildren('')
}

// "Is this prompt under (or equal to) the given folder?" An empty string
// matches everything (root).
export function isUnderFolder(p: Prompt, folder: string): boolean {
  if (folder === '' || folder === '.') return true
  return p.folder === folder || p.folder.startsWith(folder + '/')
}

export function formatDate(s: string | undefined): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return (
    d.toLocaleDateString() +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

// Convert a POSIX-internal path to a Windows-friendly display form. The
// underlying data stays POSIX so comparisons keep working; this is a UI
// nicety only.
export function toWindowsDisplay(p: string): string {
  return p.replace(/\//g, '\\')
}
