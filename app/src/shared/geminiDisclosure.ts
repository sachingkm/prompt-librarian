// Single source of truth for the Gemini data-use disclosure shown in
// Settings and the first-use confirm dialog. Decoupled from key source:
// Google's free-tier vs paid-tier data-use distinction applies to the
// REQUEST tier, not to how the user supplied their key.
//
// Verified against Gemini pricing docs 2026-05-08; re-verify quarterly.
// Source: https://ai.google.dev/gemini-api/docs/pricing
//
// Pricing-page wording today: free-tier rows say "Used to improve our
// products" (yes, content is used); paid-tier rows say "Content not used
// to improve our products" (no, content is not used). The phrasing below
// is a short, accurate paraphrase suitable for in-app product copy.

export const GEMINI_DISCLOSURE =
  'Gemini free-tier requests may be used by Google to improve their products. ' +
  'Paid-tier requests are not used for that purpose according to the current Gemini ' +
  'API pricing docs.'

export const GEMINI_PRICING_DOCS_URL = 'https://ai.google.dev/gemini-api/docs/pricing'
