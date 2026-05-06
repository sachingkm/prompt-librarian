# Prompt Librarian

Local-first prompt library app and design workspace.

## Status

This repository currently contains:

- product design artifacts under `Design/`
- starter folders for the production app under `app/`
- docs and examples folders for public-project packaging

## Product Direction

The app is intended to:

- use local Markdown files as the source of truth
- require the user to explicitly choose the writable root folder
- classify and catalog prompts into a reusable folder structure
- remain usable with no cloud account or API key

## Planned Stack

- Electron
- React
- TypeScript
- Vite

## Repository Layout

- `Design/` design artifacts and handoff files
- `app/` production application code (Electron + Vite + React + TypeScript)
- `docs/` architecture and project notes
- `examples/` sample prompt-library data

## Running the app (Phase 0)

Phase 0 is a runnable scaffold only - the window opens and shows a placeholder shell. No
filesystem, onboarding, classifier, or library features are wired up yet.

Prerequisites: Node 18+ (developed against Node 24).

From the repo root:

```
cd app
npm install
npm run dev
```

That should open an Electron window titled "Prompt Librarian" with a Phase 0 placeholder UI.

Other useful scripts (run from `app/`):

- `npm run typecheck` - typecheck both the main/preload (Node) and renderer (web) projects
- `npm run build` - produce production bundles under `app/out/`
- `npm start` - preview the production build

### Windows PowerShell note

If `npm install` (or any `npm` command) fails under Windows PowerShell 5.1 with errors like
`The property 'Statement' cannot be found on this object` or `PropertyNotFoundStrict`, you've
hit a known bug in the `npm.ps1` shim shipped with some Node releases. Two workarounds:

- **Use `npm.cmd` instead of `npm`** - the `.cmd` shim bypasses the broken PowerShell script.
  Example: `npm.cmd install`, `npm.cmd run dev`.
- **Use PowerShell 7 (`pwsh`) instead of Windows PowerShell 5.1** - the modern parser API the
  shim depends on is available there.

CMD prompt and Git Bash are also unaffected and can run `npm` directly.

## Working in Google Drive (or any cloud-synced folder)

This repo currently lives inside a Google Drive folder. That works, but be aware:

- Drive's File Stream client occasionally locks files while syncing, which can cause
  intermittent `EBUSY` / `EPERM` errors during `npm install`, `npm run build`, or git
  operations. Retrying the command usually resolves it.
- `node_modules/` and `app/out/` are already covered by `.gitignore`, but Drive will still
  try to upload them. For best performance, mark `app/node_modules` and `app/out` as
  "Available offline" or - better - exclude them from Drive sync if your client supports it.
- If `.git` operations feel slow or you see "Another git process seems to be running"
  errors, pause Drive sync, complete the git operation, then resume.
- For active development, consider cloning to a non-synced folder (e.g.
  `C:\dev\prompt-librarian`) and pushing changes back to GitHub from there.

## Notes

This repository is being prepared for a public GitHub workflow. Personal machine paths should not be hardcoded into the app.
