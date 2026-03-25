---
title: "inspect batch phase 1 and phase 2 implementation"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Implement Phase 1 and Phase 2 of the inspect batch plan:

- inspect-local CLI parsing and validation for batch-capable path input
- shared path resolution, input loading, and section slicing for inspect batch

## What Changed

- Extended `inspect` option parsing to support:
  - repeated `-p, --path`
  - `--path-mode auto|manual`
  - `--no-recursive`
  - `--include-ext`
  - `--exclude-ext`
  - `--regex`
  - `--section all|frontmatter|content`
- Preserved the single-file fast path for direct regular-file inspect inputs so existing one-file behavior remains intact.
- Added shared inspect batch input loading that:
  - reuses counting-style path resolution
  - tracks direct vs directory-discovered files
  - classifies `binary file` as:
    - failure for explicit file inputs
    - skip for directory-discovered files
  - slices inspected text by section before calling detector inspection
- Added batch inspect execution with:
  - batch JSON payloads using `summary`, `files`, `skipped`, and `failures`
  - standard batch rendering with:
    - batch header
    - per-file inspect blocks
    - deterministic `Skipped` / `Failures` sections
  - settled exit-status behavior for:
    - mixed results
    - all-skipped runs
    - all-failed runs
- Added resolver source metadata so inspect can distinguish explicit inputs from directory-expanded inputs without breaking existing counting callers.
- Updated command coverage for:
  - directory expansion in inspect JSON mode
  - manual-mode directory failure behavior
  - batch section content selection
  - revised mixed text/path validation wording

## Validation

- `bun test test/command.test.ts --test-name-pattern "inspect command|batch path resolution"`
- `bun run type-check`
- `bun test test/command.test.ts`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-25-inspect-batch-command.md`

## Related Research

- `docs/researches/research-2026-03-25-inspect-batch-mode.md`
