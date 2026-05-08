// System-prompt builder for the Gemini classifier. The prompt is built
// dynamically from the loaded rules so user edits flow into the LLM
// without any code change. We also list the *exact* allowed categories
// and folders, and instruct the model not to invent new ones.

import type { ClassificationInput } from '../../../../shared/classifier'

interface Compact {
  systemInstruction: string
  userPrompt: string
}

export function buildGeminiPrompt(input: ClassificationInput): Compact {
  const { rules, allowedCategories, allowedFolders, deterministicHint, rawText } = input

  // Compact rule summary - just enough for the model to understand which
  // category maps to which folder. Keywords are NOT sent: that's the
  // deterministic classifier's job. We only ask Gemini for high-level
  // classification reasoning.
  const ruleLines: string[] = []
  for (const cat of rules.categories) {
    if (cat.enabled === false) continue
    ruleLines.push(`- "${cat.label}" -> ${cat.folder}`)
    for (const sub of cat.subcategories ?? []) {
      if (sub.enabled === false) continue
      ruleLines.push(`    - "${sub.label}" (subcategory of ${cat.label}) -> ${sub.folder}`)
    }
  }
  for (const proj of rules.projects) {
    if (proj.enabled === false) continue
    ruleLines.push(
      `- "${proj.label}" project -> ${proj.folder} (triggers: ${proj.triggers.join(', ')})`
    )
  }

  const systemInstruction = [
    'You are a prompt classifier. You output JSON only - no markdown, no prose, no fences.',
    '',
    'Goal: given a raw prompt the user wants to save, decide which library folder and category it belongs to.',
    '',
    'Allowed categories (you MUST pick one of these labels exactly):',
    allowedCategories.map((c) => `- ${c}`).join('\n'),
    '',
    'Allowed folders (you MUST pick one of these paths exactly):',
    allowedFolders.map((f) => `- ${f}`).join('\n'),
    '',
    'Available rules (label -> folder):',
    ruleLines.join('\n'),
    '',
    'Constraints:',
    '- Do not invent a folder or category. Echo one from the allowed lists.',
    '- Do not recommend any archive folder (path starts with "99-").',
    '- Tags: short lowercase words/phrases, max 8.',
    '- Title: a short useful title under 60 characters, no surrounding quotes.',
    '- Filename: lowercase Windows-safe slug ending in .md.',
    '- reuse must be one of: low, medium, high.',
    '- scope must be one of: reusable, one-off.',
    '- confidence.tier must be one of: high, medium, low.',
    '- confidence.score must be a number in [0, 1].',
    '',
    'Output exactly this JSON shape and nothing else:',
    '{',
    '  "classifierId": "ai-gemini-v1",',
    '  "provider": "gemini",',
    '  "title": "string",',
    '  "category": "string",',
    '  "subcategory": "string or empty string",',
    '  "tags": ["string"],',
    '  "reuse": "low|medium|high",',
    '  "scope": "reusable|one-off",',
    '  "recommendedFolder": "string",',
    '  "filename": "string",',
    '  "confidence": { "score": number, "tier": "high|medium|low" },',
    '  "reasoning": {',
    '    "matchedKeywords": ["string"],',
    '    "matchedTriggers": ["string"],',
    '    "suppressedBy": ["string"],',
    '    "topAlternatives": [{ "folder": "string", "score": number }],',
    '    "notes": ["string"]',
    '  }',
    '}'
  ].join('\n')

  const userParts: string[] = []
  if (deterministicHint) {
    userParts.push(
      'Local deterministic classifier suggested this; treat as a strong hint but you may disagree:'
    )
    userParts.push(
      JSON.stringify(
        {
          category: deterministicHint.category,
          subcategory: deterministicHint.subcategory,
          recommendedFolder: deterministicHint.recommendedFolder,
          tags: deterministicHint.tags,
          reuse: deterministicHint.reuse,
          confidence: deterministicHint.confidence
        },
        null,
        2
      )
    )
    userParts.push('')
  }
  userParts.push('Prompt to classify:')
  userParts.push('---')
  userParts.push(rawText)
  userParts.push('---')

  return {
    systemInstruction,
    userPrompt: userParts.join('\n')
  }
}
