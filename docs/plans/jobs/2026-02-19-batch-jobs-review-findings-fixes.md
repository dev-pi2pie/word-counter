---
title: "Batch jobs review findings fixes"
created-date: 2026-02-19
modified-date: 2026-02-19
status: completed
agent: Codex
---

## Summary

Addressed two review findings for the batch jobs route:
- Ensure worker-pool initialization failures always tear down already-started workers.
- Restore early collector-segment compaction so large batch runs do not retain full per-file segment arrays until finalization.
Also ran a benchmark-style smoke test following `docs/batch-jobs-usage-guide.md` to confirm raw total parity, JSON determinism, and expected speedup across `--jobs` values.

## What Changed

- Fixed worker init failure teardown path:
  - `src/cli/batch/jobs/worker-pool.ts`
  - Replaced direct throw during worker construction failure with `fail(...)` path so existing workers are terminated before rejection.
- Restored early compaction in baseline aggregation path:
  - `src/cli/batch/aggregate.ts`
  - Added `compactCollectorSegmentsInCountResult(...)`.
  - Applied compaction during per-file counting in `buildBatchSummary(...)` when `preserveCollectorSegments` is false.
- Extended early compaction to `--jobs > 1` load+count routes:
  - `src/cli/batch/jobs/types.ts`
  - `src/cli/batch/jobs/load-count-experimental.ts`
  - `src/cli/batch/jobs/load-count-worker-experimental.ts`
  - `src/cli/batch/jobs/worker-pool.ts`
  - `src/cli/batch/jobs/worker/protocol.ts`
  - `src/cli/batch/jobs/worker/count-worker.ts`
  - Propagated `preserveCollectorSegments` through async and worker executors and compacted results immediately after counting.
- Updated runtime call sites to pass the new count option:
  - `src/cli/batch/run.ts`

## Validation

- `bun run type-check`
- `bun test test/command.test.ts`

## Benchmark Smoke Test

Commands:

- Build:
  - `bun run build`
- Reset fixture:
  - `node examples/manage-huge-logs.mjs reset 2000 400`
- Benchmark profile:
  - `node dist/esm/bin.mjs --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs <n>`
- Determinism smoke checks:
  - `node dist/esm/bin.mjs --path ./examples/test-case-multi-files-support --format json --quiet-skips --misc [--jobs 1|4]`
  - `node dist/esm/bin.mjs --path ./examples/test-case-multi-files-support --format json --quiet-skips --total-of whitespace,words [--jobs 1|4]`

Results (3 runs each):

- `jobs=1`: median `875.58ms`, p95 `889.16ms`
- `jobs=2`: median `534.15ms`, p95 `536.19ms`
- `jobs=4`: median `358.21ms`, p95 `360.17ms`
- `jobs=8`: median `320.34ms`, p95 `321.97ms`
- Raw total parity across all benchmark runs/jobs: `822000` (consistent)

Determinism:

- `--misc`: consistent across no jobs, `--jobs 1`, `--jobs 4`
- `--total-of whitespace,words`: consistent across no jobs, `--jobs 1`, `--jobs 4`

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
