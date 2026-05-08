// View states for the library browser. The browser owns scan state; this
// file just enumerates which slice of the scanned prompts is visible at any
// given time.

export type View =
  | { kind: 'home' }
  | { kind: 'all' }
  | { kind: 'recent' }
  | { kind: 'archive' }
  | { kind: 'hygiene' }
  | { kind: 'folder'; folder: string }

export interface FolderNode {
  name: string
  // POSIX-normalized folder path relative to the library root.
  // Empty string means the library root itself.
  path: string
  // Total prompts under this folder, including descendants.
  count: number
  // Prompts directly in this folder (no descendant nesting).
  ownCount: number
  children: FolderNode[]
}

export interface BrowserTotals {
  all: number
  recent: number
  archive: number
  hygiene: number
}
