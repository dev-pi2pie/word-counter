---
title: "Batch jobs concurrency phase 1-3 implementation"
created-date: 2026-02-19
status: completed
agent: Codex
---

## Summary

Implemented Phase 1 to Phase 3 for batch jobs concurrency:
- Stable route: `--jobs` opt-in bounded load concurrency with deterministic output.
- Experimental route: `--experimental-load-count` bounded load+count processing.
- Modular architecture under `src/cli/batch/jobs/`.

## What Changed

- Added CLI options:
  - `--jobs <n>` (integer `>= 1`, default `1`)
  - `--experimental-load-count`
  - `--print-jobs-limit` (standalone)
- Added jobs modules:
  - `src/cli/batch/jobs/types.ts`
  - `src/cli/batch/jobs/queue.ts`
  - `src/cli/batch/jobs/limits.ts`
  - `src/cli/batch/jobs/strategy.ts`
  - `src/cli/batch/jobs/load-only.ts`
  - `src/cli/batch/jobs/load-count-experimental.ts`
  - `src/cli/batch/jobs/render.ts`
- Updated batch runtime wiring:
  - `src/cli/batch/run.ts`
  - `src/cli/runtime/batch.ts`
  - `src/command.ts`
  - `src/cli/program/options.ts`
  - `src/cli/runtime/options.ts`
  - `src/cli/runtime/types.ts`
- Refactored aggregation finalize path:
  - Added `finalizeBatchSummaryFromFileResults` in `src/cli/batch/aggregate.ts`.

## Safety and Behavior

- Output determinism preserved by index-stable queue result slots.
- Added advisory warning when requested jobs exceed suggested host limit.
- Added explicit resource-limit failure for `EMFILE`/`ENFILE` with actionable guidance.
- `--print-jobs-limit` enforces standalone-only usage.

## Verification

- `bun test`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
