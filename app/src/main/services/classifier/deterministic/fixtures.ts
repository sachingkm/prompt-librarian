// Test fixtures for the deterministic classifier. Used by classifier.test.ts.
// Each fixture asserts a subset of the result so tests stay readable when
// the heuristic changes.

import type { ConfidenceTier, ReuseLevel, Scope } from '../../../../shared/classifier'

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
    // No strong keywords - we expect fallback.
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
    // "template", "reusable", "every time" all live in reuseDefaults.high
    // and the Examples category. We expect Examples to win and reuse=high.
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
    // "PRD" + "acceptance criteria" should beat "research" + "synthesis".
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
