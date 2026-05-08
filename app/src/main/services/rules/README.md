# RulesService

Single owner of the on-disk classification rules file. Lives under the
chosen library root at `<library-root>/.prompt-librarian/rules.json`. The
`.prompt-librarian` folder is dot-prefixed app metadata, kept visually
separate from the user's prompt notes; we do not rely on Windows hidden
attributes.

## Phase 4B seam

The Phase 4B visual editor is a renderer-side UI only. It will:

- call `rules:get` to fetch the current `RulesPayload` (rules + validation
  + on-disk path)
- show the rule tree, let the user toggle `enabled`, edit weights,
  reorder, add/remove categories/keywords/projects
- call `rules:get` then re-validate locally on each keystroke using the
  exported `validateClassifierRules()` from `app/src/shared/classifierRules.ts`
- compute a "modified from defaults" diff against `DEFAULT_CLASSIFIER_RULES`
- when the user clicks Save, send the entire updated `ClassifierRules`
  object back through a future `rules:write` IPC handler (deferred)

Everything the editor needs is already exposed by Phase 4A:

| Need | Phase 4A export |
| --- | --- |
| Schema types | `ClassifierRules` (and friends) in `shared/classifierRules.ts` |
| Validation | `validateClassifierRules()` |
| Defaults snapshot for diffing | `DEFAULT_CLASSIFIER_RULES` |
| Folder reachability check | `collectRuleFolders()` + `library:listFolders` IPC |
| Read current rules | `rules:get` IPC -> `RulesPayload` |
| Reset to defaults | `rules:reset` IPC |
| Reload from disk | `rules:reload` IPC |
| Open in OS editor | `rules:openInEditor` IPC |

Phase 4B will need exactly **one** new IPC handler that Phase 4A does
not provide: `rules:write(rules)` to persist edits atomically. Everything
else is already plumbed.

## Lifecycle

- `rules:get` is the boot read. It performs:
  1. If `.prompt-librarian/rules.json` is missing, write
     `DEFAULT_CLASSIFIER_RULES` and return it.
  2. If present and valid, return `{ rules, validation:{ok:true},
     usingDefaults:false }`.
  3. If present but invalid (JSON syntax or schema), DO NOT overwrite the
     user's file. Return `{ rules: DEFAULT, validation:{...errors},
     usingDefaults:true }`. The renderer surfaces a non-fatal banner and
     classification keeps working with defaults for this session.

- The classifier always re-reads rules at the start of each `classify`
  call (no in-memory cache, no file watcher). A user editing rules.json
  in another tool sees their change at the next classify click. There is
  no race here because file reads are atomic at this size.

- `rules:reset` overwrites the on-disk file with `DEFAULT_CLASSIFIER_RULES`.
  The renderer must call `confirmDialog` before invoking it; main does
  not gate on confirmation by itself.

## Atomic writes

Writes go through `writeFile` to a temp file in the same directory then
`rename`. Renames are atomic on Windows for same-volume targets. We do
not write the user's rules.json from any other code path.
