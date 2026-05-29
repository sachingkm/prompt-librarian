// Tests for updatePrompt (Phase 5 edit). Mocks settings.getRootPath so the
// service resolves against a temp library instead of the real userData root.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hoisted = vi.hoisted(() => ({ root: '' }))
vi.mock('./settings', () => ({
  getRootPath: async () => hoisted.root
}))

import { stringifyPrompt, updatePrompt } from './library'
import type { PromptDraft } from '../../shared/ipc'

let tmp = ''
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pl-update-'))
  hoisted.root = tmp
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

async function seed(folder: string, filename: string, body: string): Promise<string> {
  const dir = join(tmp, folder)
  await fs.mkdir(dir, { recursive: true })
  const draft: PromptDraft = {
    folder,
    filename,
    frontmatter: {
      title: 'Original',
      category: 'Create',
      tags: ['a'],
      reuse: 'medium',
      scope: 'reusable',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    },
    body
  }
  await fs.writeFile(join(dir, filename), stringifyPrompt(draft), 'utf8')
  return `${folder}/${filename}`
}

function editDraft(folder: string, filename: string, body: string): PromptDraft {
  return {
    folder,
    filename,
    frontmatter: {
      title: 'Edited',
      category: 'Create',
      tags: ['a', 'b'],
      reuse: 'high',
      scope: 'reusable',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-02-02T00:00:00.000Z'
    },
    body
  }
}

describe('updatePrompt', () => {
  it('edits in place when folder and filename are unchanged', async () => {
    const rel = await seed('02-Create', 'note.md', 'old body')
    const result = await updatePrompt(rel, editDraft('02-Create', 'note.md', 'new body'))
    expect(result.ok).toBe(true)
    expect(result.relPath).toBe('02-Create/note.md')
    const onDisk = await fs.readFile(join(tmp, '02-Create', 'note.md'), 'utf8')
    expect(onDisk).toContain('new body')
    expect(onDisk).toContain('title: Edited')
    expect(onDisk).toContain('2026-02-02') // updated_at bumped
  })

  it('relocates (writes new, removes old) when the folder changes', async () => {
    const rel = await seed('02-Create', 'note.md', 'body')
    const result = await updatePrompt(rel, editDraft('03-Job Search', 'note.md', 'body'))
    expect(result.ok).toBe(true)
    expect(result.relPath).toBe('03-Job Search/note.md')
    // New exists, old gone.
    await expect(fs.stat(join(tmp, '03-Job Search', 'note.md'))).resolves.toBeDefined()
    await expect(fs.stat(join(tmp, '02-Create', 'note.md'))).rejects.toBeTruthy()
  })

  it('relocates when the filename changes', async () => {
    const rel = await seed('02-Create', 'note.md', 'body')
    const result = await updatePrompt(rel, editDraft('02-Create', 'renamed.md', 'body'))
    expect(result.ok).toBe(true)
    expect(result.relPath).toBe('02-Create/renamed.md')
    await expect(fs.stat(join(tmp, '02-Create', 'note.md'))).rejects.toBeTruthy()
  })

  it('raises a collision when relocating onto a different existing file', async () => {
    const relA = await seed('02-Create', 'a.md', 'body a')
    await seed('02-Create', 'b.md', 'body b')
    const result = await updatePrompt(relA, editDraft('02-Create', 'b.md', 'body a'))
    expect(result.ok).toBe(false)
    expect(result.collision).toBe(true)
    // Both files left intact.
    await expect(fs.stat(join(tmp, '02-Create', 'a.md'))).resolves.toBeDefined()
    const bOnDisk = await fs.readFile(join(tmp, '02-Create', 'b.md'), 'utf8')
    expect(bOnDisk).toContain('body b') // not clobbered
  })

  it('overwrites a colliding target when strategy is overwrite', async () => {
    const relA = await seed('02-Create', 'a.md', 'body a')
    await seed('02-Create', 'b.md', 'body b')
    const result = await updatePrompt(relA, editDraft('02-Create', 'b.md', 'merged'), {
      strategy: 'overwrite'
    })
    expect(result.ok).toBe(true)
    const bOnDisk = await fs.readFile(join(tmp, '02-Create', 'b.md'), 'utf8')
    expect(bOnDisk).toContain('merged')
    // Original a.md removed by the relocate.
    await expect(fs.stat(join(tmp, '02-Create', 'a.md'))).rejects.toBeTruthy()
  })

  it('returns an error when the original prompt does not exist', async () => {
    const result = await updatePrompt('02-Create/missing.md', editDraft('02-Create', 'missing.md', 'x'))
    expect(result.ok).toBe(false)
    expect(result.collision).toBeFalsy()
  })
})
