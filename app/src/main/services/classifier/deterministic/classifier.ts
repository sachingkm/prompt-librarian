// Thin re-export of the renderer-safe deterministic classifier in
// shared/classifier/deterministic.ts. Both main and renderer call into
// the same pure module so the editor preview matches main's classify.

export {
  classifyDeterministic,
  deterministicClassifier,
  windowsSafeSlug
} from '../../../../shared/classifier/deterministic'
