import { resolve, normalize, sep, isAbsolute, relative } from 'node:path'

// Convert any path to forward-slash form for stable display and storage.
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

// Reject relative paths that would escape the root, or absolute paths that
// don't sit inside the root. Returns the absolute resolved path on success.
export function safeResolveWithin(root: string, relOrAbs: string): string {
  const cleaned = relOrAbs.replace(/^[/\\]+/, '')
  const normalizedRel = normalize(cleaned)
  if (isAbsolute(normalizedRel)) {
    throw new Error(`Path must be relative to library root: ${relOrAbs}`)
  }
  const resolvedRoot = resolve(root)
  const resolved = resolve(resolvedRoot, normalizedRel)
  const rel = relative(resolvedRoot, resolved)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path escapes library root: ${relOrAbs}`)
  }
  return resolved
}

// Convert an absolute path under root to a posix relative path.
export function toRelPosix(root: string, absPath: string): string {
  return toPosix(relative(resolve(root), absPath))
}

// Validate a single filename component for Windows-unsafe characters.
const INVALID_FILENAME = /[<>:"|?*\x00-\x1F]/
const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
])

export function assertValidFilename(name: string): void {
  if (!name) throw new Error('Filename is empty')
  if (name.includes('/') || name.includes('\\')) {
    throw new Error(`Filename must not contain path separators: ${name}`)
  }
  if (INVALID_FILENAME.test(name)) {
    throw new Error(`Filename contains invalid characters: ${name}`)
  }
  const base = name.replace(/\.[^.]+$/, '').toUpperCase()
  if (RESERVED_NAMES.has(base)) {
    throw new Error(`Filename uses a reserved Windows name: ${name}`)
  }
  if (name.endsWith(' ') || name.endsWith('.')) {
    throw new Error(`Filename must not end with a space or dot: ${name}`)
  }
}

export const PATH_SEP = sep
