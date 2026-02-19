---
title: "Batch jobs phase 5 strategy consolidation"
created-date: 2026-02-19
status: completed
agent: Codex
---

## Summary

Implemented Phase 5 so `--jobs` is now the only user-facing concurrency control:

- default/no `--jobs` and `--jobs=1` use the no-extra-worker route.
- `--jobs>1` uses the worker `load+count` route by default.
- async `load+count` remains an internal fallback when worker route is unavailable.

## What Changed

- Removed user-facing experimental flag from CLI options:
  - `src/cli/program/options.ts`
  - `src/cli/runtime/types.ts`
- Switched jobs strategy resolution to policy-by-jobs:
  - `src/cli/batch/jobs/strategy.ts`
  - `src/cli/batch/jobs/types.ts`
  - `src/cli/runtime/batch.ts`
- Updated batch jobs tests to match unified policy:
  - `test/command.test.ts`
- Updated README batch docs for unified jobs behavior:
  - `README.md`
- Marked Phase 5 checklist items complete:
  - `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`

## Validation

- `bun run type-check`
- `bun test test/command.test.ts`
- `bun run build`

## Quick Benchmark Snapshot

Fixture setup:

- `node examples/manage-huge-logs.mjs reset 2000 400`

Command profile:

- `node dist/esm/bin.mjs --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs <n>`
- 3 runs per jobs value (`1,2,4,8`)

Observed (median / p95, ms):

- `jobs=1`: `896.04 / 897.14`
- `jobs=2`: `539.51 / 542.23`
- `jobs=4`: `347.74 / 350.99`
- `jobs=8`: `310.94 / 314.52`

Parity check:

- raw totals remained identical across runs and jobs values (`822000`).

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
