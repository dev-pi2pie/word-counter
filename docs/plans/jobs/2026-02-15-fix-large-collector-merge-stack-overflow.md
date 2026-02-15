---
title: "Fix stack overflow on large collector batch merges"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Fix `Maximum call stack size exceeded` during CLI batch counting with large `collector`-mode segment payloads (for example `-p <dir> -m colle --non-words`).

## Root Cause

- Batch collector aggregation used spread-based appends (`push(...segments)`), which can exceed the runtime argument limit when a file contributes a very large segment list.
- Similar spread-based append patterns existed in non-word merges and other batch accumulation paths, carrying the same risk profile.

## What Changed

- Added `appendAll` helper (`src/utils/append-all.ts`) for safe iterative array appends.
- Replaced spread-based appends with `appendAll` in:
  - `src/cli/batch/aggregate.ts`
  - `src/wc/analyze.ts`
  - `src/wc/non-words.ts`
  - `src/cli/path/resolve.ts`
  - `src/cli/batch/run.ts`
- Added regression test coverage:
  - `test/command.test.ts` now includes a large collector merge scenario that previously overflowed.
  - `test/command.test.ts` now includes a 1,091-markdown-file collector batch scenario matching reported usage scale.
- Updated `README.md` to clarify that `collector` mode keeps per-locale segments in memory and can be heavier on very large corpora.

## Validation

- `bun test test/command.test.ts`
- `bun test`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
