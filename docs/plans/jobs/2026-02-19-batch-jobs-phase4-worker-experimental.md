---
title: "Batch jobs phase 4 worker experimental route"
created-date: 2026-02-19
status: completed
agent: Codex
---

## Summary

Implemented Phase 4 worker-based experimental route for `--experimental-load-count` using `worker_threads`, with deterministic ordering and fallback to the async experimental executor when workers are unavailable.

## What Changed

- Added worker protocol and worker entry:
  - `src/cli/batch/jobs/worker/protocol.ts`
  - `src/cli/batch/jobs/worker/count-worker.ts`
- Added worker pool:
  - `src/cli/batch/jobs/worker-pool.ts`
- Added worker-route executor with fallback handling:
  - `src/cli/batch/jobs/load-count-worker-experimental.ts`
- Updated batch runtime route selection/execution:
  - `src/cli/batch/run.ts`

## Behavior Notes

- Experimental route now prefers worker-pool execution.
- Unsupported worker environments fall back to async experimental executor and emit `batch.jobs.executor` with `executor: "async-fallback"`.
- Worker protocol mismatch/crash/task-fatal errors are surfaced as explicit errors.
- Resource-limit failures (`EMFILE`/`ENFILE`) surface actionable guidance.

## Validation

- `bun run type-check`
- `bun test`
- Added parity/fallback tests in:
  - `test/command.test.ts`

## Quick Performance Signal

Local quick run (`examples/test-case-huge-logs`, 2000 files x 400 words):
- Stable route (`--jobs 1`): around `0.74s` wall time.
- Experimental worker route (`--jobs 4`): around `0.26-0.27s` wall time.

This indicates meaningful speedup from true CPU-parallel counting.

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
