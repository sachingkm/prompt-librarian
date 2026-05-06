# Prompt Librarian - Build Specification

Build a real phase-1 local desktop app called `Prompt Librarian`. Use the design files in `design/` as implementation reference, especially:

- `design/Notes.html`
- `design/Prompt Librarian.html`
- any supporting JSX/component files in `design/`

Treat the design files as the source of truth for user flow, screen layout intent, interaction priorities, and UX details. Do not copy the design artifacts blindly into production if they are low-quality or prototype-only. Re-implement them pragmatically in a maintainable Electron + React + TypeScript codebase.

---

## Product goal

Build a usable local-first desktop app that lets a user:

- choose a root prompt-library folder on disk
- initialize a default prompt-library structure
- paste a raw prompt
- classify it deterministically
- edit inferred metadata
- save it as Markdown into the right folder
- create missing folders safely
- browse / search / edit / move / archive prompts
- use the app today with no API key and no cloud dependency

---

## Public GitHub project principles

This project will be published on GitHub for others to download and use. That means:

- do not hardcode personal paths
- do not assume Google Drive exists
- do not assume any user-specific environment
- first-run onboarding is a core feature
- every user must choose or create their own library root
- support both:
  - create a new prompt library
  - use an existing prompt library
- keep local Markdown files as the source of truth
- keep the file format human-readable and portable
- never silently overwrite or delete user files
- the repo should be understandable and runnable by another developer

---

## Locked design rules

1. Local Markdown files are the source of truth.
2. The user must explicitly choose the writable root folder.

---

## Important organization rules

- Do **NOT** organize prompts by model vendor
- Do **NOT** create `_gpt`, `_cld`, `_ag` file variants for stored prompts
- If model-specific notes exist, keep them inside the same prompt file under notes or compatibility notes
- Organize prompts by function, domain, and project

> Note: The `_cld` suffix rule above applies to **prompts stored inside the app's library**. It does not apply to project-level files (like this `SPEC_cld.md`), which follow the user's general file-suffix convention.

---

## Technology direction

Preferred stack:

- Electron
- React
- TypeScript
- Vite

Use:

- Electron main process for local filesystem access
- preload bridge for safe renderer access
- React renderer for UI
- Markdown + frontmatter files on disk as source of truth

Do not require a database for v1 unless absolutely necessary. If any cache or index is added, it must be derived from the Markdown library.

---

## Repo expectations

Organize the project cleanly for GitHub publication. Target repo shape:

- `design/` - reference design artifacts
- `app/` - production app code
- `docs/` - architecture or future notes
- `examples/` - sample prompt libraries or sample prompt files
- `README.md`
- `LICENSE`
- `.gitignore`

If a better repo structure is warranted, keep it clean and obvious.

---

## Core product features

### 1. First-run onboarding

Implement a real first-run flow:

- choose existing prompt library root
- or create a new prompt library root
- optionally initialize the default folder structure
- explain that local Markdown files are the source of truth
- persist the chosen root path in local app settings
- allow changing root later in settings

### 2. Default starter structure

Support initialization of this structure:

```
Prompt Library/
  00-Index/
  01-Core Transforms/
  02-Interview/
  03-Job Search/
  04-Product Specs/
  05-Research/
  06-Project Prompts/
    Career Buddy/
    OpenClaw/
  90-Examples/
  99-Archive/
```

Do not assume the user must use this forever. It is just a starter structure.

### 3. Library browser

Implement:

- left sidebar folder tree
- main panel prompt list / editor area
- right-side metadata/details area if supported by the design
- refresh library from disk
- clear empty states

### 4. Prompt intake and classification

Implement:

- large intake area for pasted raw prompt
- classify action
- deterministic rule-based classifier for v1
- infer:
  - title
  - category
  - subcategory
  - tags
  - reuse level
  - reusable vs one-off
  - recommended folder path
  - filename
- show confidence and reasoning if practical
- allow user override of every inferred field before save

### 5. Save flow

Implement:

- Markdown save with frontmatter
- automatic creation of missing folders
- safe path handling
- filename collision handling with explicit options:
  - overwrite
  - save copy
  - cancel

### 6. Prompt detail / editing

Implement:

- open existing prompt file
- edit frontmatter-backed metadata
- edit prompt Markdown body
- preview Markdown
- copy prompt text quickly
- duplicate prompt
- move prompt
- archive prompt

### 7. Search

Implement search by:

- title
- tags
- category
- subcategory
- content text

Search must return usable results quickly and allow direct open.

### 8. Library hygiene / indexing

Implement either:

- generated index note(s), or
- a lightweight generated JSON catalog, or both

But keep Markdown files on disk as source of truth. If practical, include:

- recently added prompts
- high-reuse prompts
- prompts with weak/missing metadata

---

## Classification heuristics

Use deterministic keyword/pattern scoring first. Priority:

1. function
2. domain
3. project
4. scope

Example heuristics:

- `transcript`, `transcriber`, `speaker`, `timestamp`, `inaudible`, `dialogue` → `01-Core Transforms / Transcript Cleanup`
- `interview`, `recruiter`, `hiring manager`, `STAR`, `mock interview` → `02-Interview`
- `resume`, `JD`, `job description`, `role`, `candidate`, `cover letter` → `03-Job Search`
- `PRD`, `specification`, `architecture`, `requirements`, `feature` → `04-Product Specs`
- `research`, `compare`, `synthesis`, `findings`, `evidence` → `05-Research`
- explicit project names like `OpenClaw` or `Career Buddy` → `06-Project Prompts / matching project`

---

## Prompt file format

Use Markdown with frontmatter like this:

```yaml
---
title: Prompt Title
category: Core Transforms
subcategory: Transcript Cleanup
tags:
  - transcript
  - interview
reuse: high
scope: reusable
created_at: ISO_TIMESTAMP
updated_at: ISO_TIMESTAMP
---
```

Body sections:

```markdown
# Prompt Title

## Purpose
Short description

## Inputs Required
- List

## Output
Expected output shape

## Prompt
Full prompt text

## Notes
Usage notes and caveats

## Compatibility Notes
Optional notes on behavior with different LLMs, but never used for folder placement
```

---

## Engineering requirements

- support Windows paths correctly
- use safe path normalization and validation
- keep code modular and maintainable
- separate filesystem, parsing, classification, indexing, and UI concerns
- do not silently mutate or delete unrelated user files
- make local run instructions straightforward
- include a few sample prompt files in `examples/`

---

## AI usage requirements

The app must be fully usable without an API key. Optional:

- create a clean abstraction for future AI-assisted classification
- keep it disabled by default
- do not make it required
- do not ship with cloud dependency for v1

---

## README / open-source expectations

Include:

- what the app does
- why local Markdown is the source of truth
- how first-run setup works
- how to run locally
- how to build/package locally
- sample folder/library explanation
- known limitations
- future phase note for possible hosted Google Cloud version later

Also include:

- `LICENSE`
- `.gitignore`
- sensible package metadata
- no personal machine assumptions

---

## Definition of done

The implementation is not done until all of this is true:

- I can clone and run the app locally
- On first launch, I can choose or create a prompt-library root
- I can initialize the default folder structure
- I can paste a raw prompt, classify it, edit inferred metadata, and save it
- The app creates missing folders safely
- Saved prompts are Markdown files readable outside the app
- I can browse, search, open, edit, move, duplicate, and archive prompts
- Filename collisions are handled explicitly
- The repo is clean enough to publish on GitHub
- The app works with no API key
- The design files were used as implementation guidance, not ignored

---

## Final delivery requirements

Before finishing:

1. run the app locally
2. verify first-run onboarding
3. verify folder selection
4. verify starter-structure creation
5. verify classify flow
6. verify save flow
7. verify collision handling
8. verify browse / search / edit / move / archive flows
9. verify Markdown files are readable outside the app
10. summarize architecture and any remaining tradeoffs

Do not stop at scaffolding. Do not stop at prototype-quality code. Build a usable working v1 today. If tradeoffs are needed, prioritize the shortest path to a solid, reliable local app.
