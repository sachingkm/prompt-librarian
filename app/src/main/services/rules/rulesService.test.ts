// Tests for the Phase 4B writeRules path.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLASSIFIER_RULES_VERSION,
  ClassifierRules,
  DEFAULT_CLASSIFIER_RULES
} from '../../../shared/classifierRules'
import { loadRules, rulesPath, writeRules } from './rulesService'

let tmp = ''
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pl-rules-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const validRules: ClassifierRules = {
  ...DEFAULT_CLASSIFIER_RULES,
  categories: [
    ...DEFAULT_CLASSIFIER_RULES.categories,
    {
      id: 'sql',
      label: 'SQL',
      folder: '07-SQL',
      enabled: true,
      priority: 1,
      keywords: [{ term: 'sql', weight: 3 }],
      tags: ['sql']
    }
  ]
}

describe('writeRules', () => {
  it('writes valid rules atomically and returns the loaded payload', async () => {
    const result = await writeRules(tmp, validRules)
    expect(result.validation.ok).toBe(true)
    expect(result.usingDefaults).toBe(false)
    const onDisk = JSON.parse(readFileSync(rulesPath(tmp), 'utf8')) as ClassifierRules
    expect(onDisk.categories.find((c) => c.id === 'sql')).toBeDefined()
  })

  it('rejects invalid rules and leaves disk unchanged', async () => {
    // Seed a valid file first.
    await writeRules(tmp, validRules)
    const before = readFileSync(rulesPath(tmp), 'utf8')

    const broken: ClassifierRules = {
      ...validRules,
      version: 999 as unknown as number
    }
    const result = await writeRules(tmp, broken)
    expect(result.validation.ok).toBe(false)
    expect(result.validation.errors[0]?.path).toBe('/version')
    const after = readFileSync(rulesPath(tmp), 'utf8')
    expect(after).toEqual(before)
  })

  it('seed-on-load writes minimal defaults when file is missing', async () => {
    const loaded = await loadRules(tmp)
    expect(loaded.rules.version).toBe(CLASSIFIER_RULES_VERSION)
    expect(loaded.rules.categories.find((c) => c.id === 'transform')).toBeDefined()
    expect(loaded.rules.categories.find((c) => c.id === 'create')).toBeDefined()
    // Confirm the file actually exists now.
    const onDisk = JSON.parse(readFileSync(rulesPath(tmp), 'utf8')) as ClassifierRules
    expect(onDisk.categories.length).toBe(2)
  })

  it('does not overwrite an existing valid file when loading defaults', async () => {
    // First write valid custom rules.
    await writeRules(tmp, validRules)
    // Subsequent loadRules should return the file as-is.
    const loaded = await loadRules(tmp)
    expect(loaded.rules.categories.find((c) => c.id === 'sql')).toBeDefined()
  })

  it('treats malformed JSON as invalid and uses defaults without overwriting', async () => {
    const file = rulesPath(tmp)
    await import('node:fs').then((m) =>
      m.promises.mkdir(join(tmp, '.prompt-librarian'), { recursive: true })
    )
    await import('node:fs').then((m) =>
      m.promises.writeFile(file, '{ this is not valid', 'utf8')
    )
    const loaded = await loadRules(tmp)
    expect(loaded.usingDefaults).toBe(true)
    expect(loaded.validation.ok).toBe(false)
    const onDisk = readFileSync(file, 'utf8')
    expect(onDisk).toContain('not valid') // original preserved
  })
})
