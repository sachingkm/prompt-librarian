// Test fixtures for the deterministic classifier. Used by classifier.test.ts.
// Each fixture asserts a subset of the result so tests stay readable when
// the heuristic changes.
//
// Fixtures run against TEST_CLASSIFIER_RULES below (a richer taxonomy)
// rather than DEFAULT_CLASSIFIER_RULES (which is intentionally minimal in
// Phase 4B). This keeps engine-behaviour coverage intact while letting the
// shipped defaults stay generic.

import type { ConfidenceTier, ReuseLevel, Scope } from '../../../../shared/classifier'
import type { ClassifierRules } from '../../../../shared/classifierRules'
import { CLASSIFIER_RULES_VERSION } from '../../../../shared/classifierRules'

export interface Fixture {
  name: string
  text: string
  // Expected fields. Strings are checked exactly; arrays as
  // "must-include-at-least-one-of" via expectedTagsAny.
  expectedFolder: string
  expectedCategory: string
  expectedTier?: ConfidenceTier
  expectedReuse?: ReuseLevel
  expectedScope?: Scope
  expectedTagsAny?: string[]
  // Optional: assert this folder is NOT recommended.
  forbidFolder?: string
}

// Rich rules used to exercise the classifier engine. Mirrors the original
// Phase 4A starter taxonomy plus a couple of project triggers, so tests
// keep covering category scoring, sub-categories, project priority, and
// negative-keyword suppression. This is NOT what gets seeded for users.
export const TEST_CLASSIFIER_RULES: ClassifierRules = {
  version: CLASSIFIER_RULES_VERSION,
  categories: [
    {
      id: 'core-transforms',
      label: 'Core Transforms',
      folder: '01-Core Transforms',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'transcript', weight: 3 },
        { term: 'speaker', weight: 2 },
        { term: 'timestamp', weight: 2 },
        { term: 'inaudible', weight: 2 },
        { term: 'dialogue', weight: 2 },
        { term: 'rewrite', weight: 1 },
        { term: 'summarize', weight: 1 },
        { term: 'format', weight: 1 }
      ],
      tags: ['transform'],
      subcategories: [
        {
          id: 'transcript-cleanup',
          label: 'Transcript Cleanup',
          folder: '01-Core Transforms',
          enabled: true,
          keywords: [
            { term: 'inaudible', weight: 2 },
            { term: 'cleanup', weight: 2 },
            { term: 'verbatim', weight: 1 }
          ],
          tags: ['cleanup']
        }
      ]
    },
    {
      id: 'interview',
      label: 'Interview',
      folder: '02-Interview',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'interview', weight: 3 },
        { term: 'recruiter', weight: 2 },
        { term: 'hiring manager', weight: 2 },
        { term: 'star', weight: 2 },
        { term: 'mock interview', weight: 3 },
        { term: 'candidate', weight: 1 },
        { term: 'interviewer', weight: 2 }
      ],
      tags: ['interview']
    },
    {
      id: 'job-search',
      label: 'Job Search',
      folder: '03-Job Search',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'resume', weight: 3 },
        { term: 'jd', weight: 2 },
        { term: 'job description', weight: 3 },
        { term: 'role', weight: 1 },
        { term: 'cover letter', weight: 3 },
        { term: 'linkedin', weight: 2 },
        { term: 'job application', weight: 3 }
      ],
      tags: ['job-search']
    },
    {
      id: 'product-specs',
      label: 'Product Specs',
      folder: '04-Product Specs',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'prd', weight: 3 },
        { term: 'specification', weight: 3 },
        { term: 'architecture', weight: 2 },
        { term: 'requirements', weight: 2 },
        { term: 'feature', weight: 1 },
        { term: 'acceptance criteria', weight: 3 },
        { term: 'user story', weight: 3 }
      ],
      tags: ['product-spec']
    },
    {
      id: 'research',
      label: 'Research',
      folder: '05-Research',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'research', weight: 3 },
        { term: 'compare', weight: 2 },
        { term: 'synthesis', weight: 2 },
        { term: 'findings', weight: 2 },
        { term: 'evidence', weight: 2 },
        { term: 'analyze', weight: 1 }
      ],
      tags: ['research']
    },
    {
      id: 'examples',
      label: 'Examples',
      folder: '90-Examples',
      enabled: true,
      priority: 0,
      keywords: [
        { term: 'example prompt', weight: 3 },
        { term: 'sample prompt', weight: 3 },
        { term: 'template', weight: 1 }
      ],
      tags: ['example']
    }
  ],
  projects: [
    {
      id: 'career-buddy',
      label: 'Career Buddy',
      folder: '06-Project Prompts/Career Buddy',
      enabled: true,
      priority: 5,
      triggers: ['Career Buddy'],
      tags: ['career-buddy']
    },
    {
      id: 'openclaw',
      label: 'OpenClaw',
      folder: '06-Project Prompts/OpenClaw',
      enabled: true,
      priority: 5,
      triggers: ['OpenClaw'],
      tags: ['openclaw']
    }
  ],
  fallback: { folder: '00-Index', label: 'Uncategorized' },
  scoring: { highTier: 0.7, mediumTier: 0.4 },
  reuseDefaults: {
    highPhrases: ['template', 'always', 'every time', 'reusable'],
    lowPhrases: ['this specific', 'right now', 'one-off', 'just this once']
  }
}

export const FIXTURES: Fixture[] = [
  {
    name: 'transcript-to-dialogue',
    text: `Clean up this transcript. Remove [inaudible], collapse filler words, and produce a clean speaker-attributed dialogue with timestamps.`,
    expectedFolder: '01-Core Transforms',
    expectedCategory: 'Core Transforms',
    expectedTier: 'high',
    expectedTagsAny: ['transcript', 'transform']
  },
  {
    name: 'interview-prep',
    text: `Help me prepare for a behavioral interview. Use the STAR framework. The interviewer is a hiring manager at a startup.`,
    expectedFolder: '02-Interview',
    expectedCategory: 'Interview',
    expectedTier: 'high',
    expectedTagsAny: ['interview', 'star']
  },
  {
    name: 'resume-cover-letter',
    text: `Tailor my resume to this job description. Then write a cover letter for the role.`,
    expectedFolder: '03-Job Search',
    expectedCategory: 'Job Search',
    expectedTier: 'high',
    expectedTagsAny: ['resume', 'cover letter']
  },
  {
    name: 'product-spec',
    text: `Draft a PRD for a new feature. Include user stories and acceptance criteria. Keep architecture concerns separate.`,
    expectedFolder: '04-Product Specs',
    expectedCategory: 'Product Specs',
    expectedTier: 'high',
    expectedTagsAny: ['prd', 'product-spec']
  },
  {
    name: 'research-synthesis',
    text: `Compare three approaches and synthesize findings with evidence. Analyze tradeoffs.`,
    expectedFolder: '05-Research',
    expectedCategory: 'Research',
    expectedTier: 'high',
    expectedTagsAny: ['research', 'compare']
  },
  {
    name: 'career-buddy-trigger',
    text: `For Career Buddy, generate a weekly job-search recap email summarizing applications, leads, and next actions.`,
    expectedFolder: '06-Project Prompts/Career Buddy',
    expectedCategory: 'Career Buddy',
    expectedTier: 'high',
    expectedTagsAny: ['career-buddy']
  },
  {
    name: 'openclaw-trigger',
    text: `OpenClaw: write a status report describing milestones and blockers for this sprint.`,
    expectedFolder: '06-Project Prompts/OpenClaw',
    expectedCategory: 'OpenClaw',
    expectedTier: 'high',
    expectedTagsAny: ['openclaw']
  },
  {
    name: 'ambiguous-multi-cue',
    text: `Help me with my career.`,
    expectedFolder: '00-Index',
    expectedCategory: 'Uncategorized',
    expectedTier: 'low'
  },
  {
    name: 'no-match-fallback',
    text: `Tell me a poem about clouds.`,
    expectedFolder: '00-Index',
    expectedCategory: 'Uncategorized',
    expectedTier: 'low',
    forbidFolder: '99-Archive'
  },
  {
    name: 'llm-instructions-inside-body',
    text: `You are an expert assistant. Always respond reusable JSON with fields title, summary. This template should work every time.`,
    expectedFolder: '90-Examples',
    expectedCategory: 'Examples',
    expectedReuse: 'high',
    expectedScope: 'reusable'
  },
  {
    name: 'very-short',
    text: `tldr`,
    expectedFolder: '00-Index',
    expectedCategory: 'Uncategorized',
    expectedTier: 'low'
  },
  {
    name: 'very-long',
    text:
      'This is a long instructional prompt about transcripts. ' +
      'It mentions transcripts, speakers, timestamps, inaudible, dialogue, '.repeat(80) +
      'Final note: clean up the transcript verbatim.',
    expectedFolder: '01-Core Transforms',
    expectedCategory: 'Core Transforms',
    expectedTier: 'high'
  },
  {
    name: 'multi-category',
    text: `Synthesize research findings into a PRD with acceptance criteria.`,
    expectedFolder: '04-Product Specs',
    expectedCategory: 'Product Specs',
    expectedTier: 'high'
  },
  {
    name: 'capitalized-acronyms',
    text: `Convert this PRD into a one-page architecture overview with feature list.`,
    expectedFolder: '04-Product Specs',
    expectedCategory: 'Product Specs',
    expectedTier: 'high'
  },
  {
    name: 'project-name-only',
    text: `Career Buddy intake form copy edits.`,
    expectedFolder: '06-Project Prompts/Career Buddy',
    expectedCategory: 'Career Buddy',
    expectedTier: 'high'
  }
]
