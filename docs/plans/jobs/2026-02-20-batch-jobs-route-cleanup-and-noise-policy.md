---
title: "Batch jobs route cleanup and diagnostics noise policy"
created-date: 2026-02-20
status: completed
agent: Codex
---

## Summary

Implemented Phase 7 route and diagnostics cleanup work:

- Removed active `load-only` execution route and unified batch execution to `load+count`.
- Kept baseline `--jobs=1` on async main-thread `load+count`.
- Kept `--jobs>1` worker route with async fallback.
- Renamed active route modules to remove `experimental` wording.
- Added warning-tier suppression flag `--quiet-warnings`.
- Added explicit worker-fallback warning in non-fatal warning tier.
- Kept skip diagnostics debug-gated and aligned skip policy events.

## Implementation Details

- Route and file updates:
  - deleted `src/cli/batch/jobs/load-only.ts`
  - renamed:
    - `src/cli/batch/jobs/load-count-experimental.ts` -> `src/cli/batch/jobs/load-count.ts`
    - `src/cli/batch/jobs/load-count-worker-experimental.ts` -> `src/cli/batch/jobs/load-count-worker.ts`
  - added shared read/skip helper:
    - `src/cli/batch/jobs/read-input.ts`
  - updated route orchestration:
    - `src/cli/batch/run.ts`
    - `src/cli/batch/jobs/strategy.ts`
    - `src/cli/batch/jobs/types.ts`

- Diagnostics policy updates:
  - added CLI option:
    - `src/cli/program/options.ts` (`--quiet-warnings`)
  - wired warning suppression and warning emission:
    - `src/cli/runtime/batch.ts`
    - `src/cli/runtime/types.ts`
  - worker-route disable env compatibility:
    - new: `WORD_COUNTER_DISABLE_WORKER_JOBS=1`
    - legacy alias still supported: `WORD_COUNTER_DISABLE_EXPERIMENTAL_WORKERS=1`

- Test updates:
  - `test/command.test.ts`
    - updated renamed module imports
    - updated default strategy expectation (`load-count`)
    - added warning suppression coverage for:
      - jobs-limit advisory warning
      - worker-fallback warning

## Docs Updated

- `README.md`
- `docs/batch-jobs-usage-guide.md`
- `docs/breaking-changes-notes.md`
- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`

## Verification

- `bun test test/command.test.ts`
- `bun test`

Both passed.

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`
