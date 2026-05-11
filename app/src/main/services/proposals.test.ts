// Tests for LearningProposalService.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PROPOSAL_TRIGGER_COUNT,
  analyzeAndPersist,
  applyProposalToRules,
  detectClusters,
  loadStore,
  setProposalStatus
} from './proposals'
import { TEST_CLASSIFIER_RULES } from './classifier/deterministic/fixtures'
import type { Correction, CorrectionMetadata } from '../../shared/correction'

let tmp = ''
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pl-proposals-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function makeCorrection(
  preview: string,
  acceptedCategory: string,
  acceptedFolder: string,
  ts: string = new Date().toISOString(),
  rawText?: string
): Correction {
  const md = (cat: string, folder: string): CorrectionMetadata => ({
    title: 'x',
    category: cat,
    subcategory: '',
    tags: [],
    reuse: 'medium',
    scope: 'reusable',
    recommendedFolder: folder,
    filename: 'x.md'
  })
  return {
    version: 1,
    timestamp: ts,
    rawText,
    rawTextPreview: preview,
    rawTextHash: ts, // not used
    classifierId: 'deterministic-v1',
    provider: 'deterministic',
    suggested: md('Uncategorized', '00-Index'),
    accepted: md(acceptedCategory, acceptedFolder),
    changedFields: ['category', 'recommendedFolder'],
    signals: { matchedKeywords: [], matchedTriggers: [] }
  }
}

describe('detectClusters', () => {
  it('returns nothing under threshold', () => {
    const corr = [
      makeCorrection('foobar interview prep', 'Interview', '02-Interview'),
      makeCorrection('foobar another', 'Interview', '02-Interview')
    ]
    const out = detectClusters(corr)
    expect(out.length).toBe(0)
  })

  it('triggers at exactly threshold', () => {
    const corr: Correction[] = []
    for (let i = 0; i < PROPOSAL_TRIGGER_COUNT; i++) {
      corr.push(makeCorrection(`zoominfo prep round ${i}`, 'Interview', '02-Interview'))
    }
    const out = detectClusters(corr)
    expect(out.find((c) => c.token === 'zoominfo')).toBeDefined()
  })

  it('uses rawText when available so phrases past the preview boundary still cluster', () => {
    // Preview only contains stop-word filler. The discriminating token
    // "telemetry" lives in rawText. Detector should still cluster on it.
    const filler = 'the and for with that this from have'
    const corr: Correction[] = []
    for (let i = 0; i < PROPOSAL_TRIGGER_COUNT; i++) {
      corr.push(
        makeCorrection(
          filler + ' ...',
          'Engineering',
          '07-Engineering',
          new Date(2026, 0, 1, 0, i).toISOString(),
          // Long rawText whose tail contains the real signal.
          `${filler.repeat(20)} extra body. The user clearly cares about telemetry pipelines.`
        )
      )
    }
    const out = detectClusters(corr)
    expect(out.find((c) => c.token === 'telemetry')).toBeDefined()
  })

  it('falls back to rawTextPreview when older records have no rawText', () => {
    // No rawText on any record -> detector still works on previews.
    const corr: Correction[] = []
    for (let i = 0; i < PROPOSAL_TRIGGER_COUNT; i++) {
      corr.push(
        makeCorrection(`pipelines pipeline cluster ${i}`, 'Engineering', '07-Engineering')
      )
    }
    const out = detectClusters(corr)
    expect(out.find((c) => c.token === 'pipelines')).toBeDefined()
  })

  it('only considers the most recent window', () => {
    const corr: Correction[] = []
    // 12 corrections far apart, only 2 of which share a token; window=10
    // means the first ones drop out.
    for (let i = 0; i < 8; i++) {
      corr.push(makeCorrection('aardvark item', 'X', 'fX'))
    }
    for (let i = 0; i < 4; i++) {
      corr.push(makeCorrection('zonkified item', 'Y', 'fY'))
    }
    const out = detectClusters(corr)
    expect(out.find((c) => c.token === 'zonkified')).toBeDefined()
  })
})

describe('analyzeAndPersist + setProposalStatus', () => {
  it('persists a pending proposal and respects rejection on subsequent runs', async () => {
    const corr: Correction[] = []
    for (let i = 0; i < 3; i++) {
      corr.push(makeCorrection('Interview prep zoominfo', 'Interview', '02-Interview'))
    }
    const first = await analyzeAndPersist(tmp, corr, TEST_CLASSIFIER_RULES)
    expect(first.created.length).toBeGreaterThan(0)
    const proposal = first.created[0]
    await setProposalStatus(tmp, proposal.id, 'rejected')
    const second = await analyzeAndPersist(tmp, corr, TEST_CLASSIFIER_RULES)
    // Same cluster, but already rejected -> should not re-create a
    // proposal for the same token+category.
    expect(
      second.created.find(
        (p) =>
          p.proposedChange.keyword?.term === proposal.proposedChange.keyword?.term &&
          p.evidence[0]?.acceptedCategory === proposal.evidence[0]?.acceptedCategory
      )
    ).toBeUndefined()
    const store = await loadStore(tmp)
    expect(store.proposals.find((p) => p.id === proposal.id)?.status).toBe('rejected')
  })

  it('does not propose tokens that are already keywords on the target', async () => {
    // "interview" is an existing keyword on the Interview category.
    const corr: Correction[] = []
    for (let i = 0; i < 3; i++) {
      corr.push(makeCorrection('interview interview interview', 'Interview', '02-Interview'))
    }
    const result = await analyzeAndPersist(tmp, corr, TEST_CLASSIFIER_RULES)
    expect(
      result.created.find((p) => p.proposedChange.keyword?.term === 'interview')
    ).toBeUndefined()
  })
})

describe('applyProposalToRules', () => {
  it('appends a keyword to the target category', () => {
    const proposal = {
      id: 'p1',
      version: 1,
      createdAt: '',
      updatedAt: '',
      status: 'accepted' as const,
      type: 'keyword' as const,
      summary: '',
      evidenceCount: 3,
      evidence: [],
      proposedChange: {
        targetRuleId: 'interview',
        keyword: { term: 'zoominfo', weight: 2 }
      }
    }
    const next = applyProposalToRules(TEST_CLASSIFIER_RULES, proposal)
    const interview = next.categories.find((c) => c.id === 'interview')
    expect(interview?.keywords?.find((k) => k.term === 'zoominfo')).toBeDefined()
    // Original is untouched.
    const origInterview = TEST_CLASSIFIER_RULES.categories.find((c) => c.id === 'interview')
    expect(origInterview?.keywords?.find((k) => k.term === 'zoominfo')).toBeUndefined()
  })
})
