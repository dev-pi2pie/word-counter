---
title: "Batch Jobs Usage Guide"
created-date: 2026-02-19
modified-date: 2026-02-19
status: completed
agent: Codex
---

# Batch Jobs Usage Guide

## Goal

Document the current `--jobs` behavior, parity expectations, and a reproducible benchmark standard.

## Current Policy

- `--jobs` is the only concurrency control flag for batch mode.
- No `--jobs` and `--jobs 1` are equivalent baseline behavior.
- `--jobs > 1` uses worker `load+count` by default.
- If requested `--jobs` exceeds host `suggestedMaxJobs`, the CLI warns and runs with `suggestedMaxJobs` as a safety cap.
- If workers are unavailable on the host/runtime, execution falls back internally to async `load+count` while preserving deterministic output ordering.

## Usage

Baseline (equivalent):

```bash
word-counter --path ./examples/test-case-multi-files-support --format json
word-counter --path ./examples/test-case-multi-files-support --format json --jobs 1
```

Concurrent route:

```bash
word-counter --path ./examples/test-case-multi-files-support --format json --jobs 4
```

Host jobs diagnostics:

```bash
word-counter --print-jobs-limit
```

## JSON Parity Expectations

For the same inputs/options, output should stay deterministic across:

- no `--jobs`
- `--jobs 1`
- `--jobs > 1`

This includes:

- `--misc`
- `--total-of whitespace,words`

Examples:

```bash
word-counter --path ./examples/test-case-multi-files-support --format json --misc --jobs 4
word-counter --path ./examples/test-case-multi-files-support --format json --total-of whitespace,words --jobs 4
```

## Benchmark

Fixture:

```bash
node examples/manage-huge-logs.mjs reset 2000 400
```

Benchmark profile:

```bash
node dist/esm/bin.mjs --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs <n>
```

Example local snapshot (3 runs each, lower is better):

- `jobs=1`: median `896.04ms`, p95 `897.14ms`
- `jobs=2`: median `539.51ms`, p95 `542.23ms`
- `jobs=4`: median `347.74ms`, p95 `350.99ms`
- `jobs=8`: median `310.94ms`, p95 `314.52ms`
- Raw total parity across all runs/jobs: `822000`

Benchmark standard:

- Correctness: totals remain identical across `--jobs` values.
- Determinism: JSON output remains identical across no jobs, `--jobs 1`, and `--jobs > 1`.
- Performance: `--jobs 4` should show clear median improvement versus `--jobs 1` without output drift.

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
