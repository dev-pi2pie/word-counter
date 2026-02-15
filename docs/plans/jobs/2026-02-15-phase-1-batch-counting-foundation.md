---
title: "Phase 1 batch counting foundation implementation"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Implement Phase 1 (`v0.1.0-canary.0`) from `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`.

## What Changed

- Added multi-path batch input support with repeated `--path` values.
- Added batch scope controls:
  - default merged behavior (`--merged`)
  - per-file output mode (`--per-file`)
- Added path resolution controls:
  - `--path-mode <auto|manual>`
  - recursive directory traversal default with opt-out `--no-recursive`
- Added directory expansion logic with deterministic ordering.
- Added default extension allowlist for directory scans:
  - `.md`, `.markdown`, `.mdx`, `.mdc`, `.txt`
- Added binary detection + skip handling for direct file targets.
- Added skip reporting to stderr with toggle `--quiet-skips`.
- Added section-aware batch aggregation:
  - each file is counted per section first
  - section totals are aggregated after per-file counting
  - mixed markdown/txt input supports frontmatter=0 contribution for non-frontmatter files
- Preserved single-input output contracts for standard/raw/json paths.

## Tests and Validation

- Added `test/command.test.ts` with coverage for:
  - directory traversal and deterministic ordering
  - `--no-recursive` behavior
  - merged aggregation ordering
  - mixed markdown/txt section aggregation
  - `--per-file` standard output behavior
  - skip reporting + `--quiet-skips`
  - compatibility gates for single-input standard/raw/json outputs
- Executed:
  - `bun run type-check`
  - `bun test`
  - `bun run build`
  - smoke CLI runs against `examples/test-case-multi-files-support`

## Smoke Fixture

Created a real-case fixture set at:

- `examples/test-case-multi-files-support`

with markdown/text files, nested directories, excluded extensions, and a binary sample for batch/skip validation.

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
