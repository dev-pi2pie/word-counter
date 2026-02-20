---
title: "Surface worker fallback warnings in benchmark output"
created-date: 2026-02-20
status: completed
agent: Codex
---

## Summary

Updated the benchmark runner so non-fatal worker fallback warnings are visible in benchmark output instead of being silently discarded.

## Changes

- Updated `scripts/benchmark-batch-jobs.mjs`:
  - `runNode` now returns both `stdout` and `stderr` for successful invocations.
  - Added fallback warning detection for: `Worker executor unavailable; falling back to async load+count.`
  - Added per-run fallback surfacing in console output (`executor=async-fallback`).
  - Added row-level fallback metadata in JSON output:
    - `workerFallbackDetected`
    - `workerFallbackRuns`
  - Added top-level JSON flag:
    - `workerFallbackDetected`

## Verification

- Ran:
  - `node scripts/benchmark-batch-jobs.mjs --runs 1 --jobs 1 --fixture examples/test-case-multi-files-support --bin dist/esm/bin.mjs`
- Confirmed benchmark script runs successfully and emits the new fallback fields in summary/JSON output.

## Related Plans

- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`
