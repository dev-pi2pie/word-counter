---
title: "Phase 5 Layer 2 total-of option"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Implement Phase 5 Layer 2 selective total composition via `--total-of` while preserving backward-compatible defaults when the flag is not provided.

## What Changed

- Added `--total-of <parts>` CLI option with parser and normalization:
  - canonical parts: `words`, `emoji`, `symbols`, `punctuation`, `whitespace`
  - tolerant aliases: `word` -> `words`, `symbol` -> `symbols`, `punction` -> `punctuation`
  - file: `src/cli/total-of.ts`
- Added total-of override computation utilities:
  - per-result part extraction from word/non-word counts
  - section-aware aggregation support
  - non-word/whitespace collection requirement helpers
- Updated CLI execution flow (`src/command.ts`):
  - auto-enables non-word collection when selected `--total-of` parts require it
  - keeps base total/output model unchanged unless non-word flags were explicitly requested
  - `raw` output prints override total when `--total-of` is present
  - `standard` output shows `Total-of (override: ...)` only when override differs from base total
  - `json` output includes `meta.totalOf` and `meta.totalOfOverride` when `--total-of` is present
- Updated standard renderers (`src/cli/output/render.ts`) to support optional override rendering:
  - single result
  - sectioned result
  - per-file batch rendering
- Added CLI tests (`test/command.test.ts`) for:
  - standard visibility rule (show/hide override line)
  - raw override behavior
  - alias normalization (`punction`)
  - auto-enabled non-word collection for override parts
  - batch raw parity with `--total-of`

## Validation

- `bun test test/command.test.ts`
- `bun test`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
