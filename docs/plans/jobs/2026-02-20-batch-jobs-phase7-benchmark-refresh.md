---
title: "Batch jobs phase 7 benchmark refresh"
created-date: 2026-02-20
modified-date: 2026-02-20
status: completed
agent: Codex
---

## Summary

Completed the remaining Phase 7 benchmark and validation tasks:

- Added local benchmark runner script:
  - `scripts/benchmark-batch-jobs.mjs`
- Rebuilt benchmark fixture using:
  - `node examples/manage-huge-logs.mjs reset 2000 400`
- Ran benchmark matrix (`--jobs 1,2,4,8`, 3 runs each) with low-noise raw profile.
- Captured refreshed median/p95 and parity results.
- Ran targeted CLI smoke checks for `--jobs` policy and `--print-jobs-limit`.

## Benchmark Command

Primary profile:

```bash
node dist/esm/bin.mjs --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs <n>
```

Scripted runner:

```bash
node scripts/benchmark-batch-jobs.mjs --runs 6 --jobs 1,2,4,8
```

## Results (Local Snapshot)

- `jobs=1`: median `872.16ms`, p95 `889.88ms`
- `jobs=2`: median `533.90ms`, p95 `550.64ms`
- `jobs=4`: median `350.70ms`, p95 `353.22ms`
- `jobs=8`: median `312.61ms`, p95 `326.22ms`
- Raw total parity across all runs/jobs: `822000` (consistent)

Host limits during run:

- `suggestedMaxJobs`: `8`
- `cpuLimit`: `10`
- `uvThreadpool`: `4`
- `ioLimit`: `8`

## Targeted CLI Smoke Checks

Commands:

- `node dist/esm/bin.mjs --path ./examples/test-case-multi-files-support --format raw`
- `node dist/esm/bin.mjs --path ./examples/test-case-multi-files-support --format raw --jobs 1`
- `node dist/esm/bin.mjs --path ./examples/test-case-multi-files-support --format raw --jobs 4`
- `node dist/esm/bin.mjs --print-jobs-limit`

Observed:

- Raw outputs were consistent: `36` for default/no jobs, `--jobs 1`, and `--jobs 4`.
- Jobs-limit diagnostics returned JSON with expected fields:
  - `suggestedMaxJobs`
  - `cpuLimit`
  - `uvThreadpool`
  - `ioLimit`

## Docs Updated

- `docs/batch-jobs-usage-guide.md`
- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`
