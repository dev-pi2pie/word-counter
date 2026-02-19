---
title: "Batch jobs concurrency and diagnostics"
created-date: 2026-02-19
modified-date: 2026-02-19
status: draft
agent: Codex
---

## Goal

Deliver a focused improvement set that improves large-batch runtime via bounded concurrency and practical host diagnostics, without changing counting semantics.

## Scope

- In scope:
  - `--jobs <n>` bounded concurrency in batch mode.
  - Standalone `--print-jobs-limit` diagnostics flag.
  - Benchmark and parity validation for deterministic behavior.
- Out of scope:
  - `worker_threads` true multi-core parallelism.
  - WASM/statistical language detection.
  - Full `doctor` subcommand.

## Phase Task Items

### Phase 1 - `--jobs` Bounded Concurrency

- [ ] Add `--jobs <n>` CLI option with validation (`integer >= 1` and capped, proposed `<= 32`).
- [ ] Keep default `--jobs=1` for compatibility-safe rollout.
- [ ] Implement bounded queue concurrency in batch processing path (no unbounded `Promise.all`).
- [ ] Preserve deterministic output by storing file results via original sorted index before finalize/render.
- [ ] Keep JSON/standard/raw contracts unchanged (only runtime speedup and new optional metadata flag).
- [ ] Ensure progress and debug behavior remain consistent under concurrent completion.
- [ ] Add tests for:
  - deterministic per-file order across `--jobs` values
  - aggregate total parity across `--jobs` values
  - sectioned and non-sectioned parity across `--jobs` values

### Phase 2 - Diagnostics: `--print-jobs-limit`

- [ ] Add standalone `--print-jobs-limit` flag.
- [ ] Enforce standalone-only usage (reject with non-zero when combined with other runtime flags or inputs).
- [ ] Output a single JSON object to `stdout` with:
  - `suggestedMaxJobs`
  - `cpuLimit`
  - `uvThreadpool`
  - `ioLimit`
  - `hardCap`
- [ ] Implement heuristic:
  - `cpuLimit = os.availableParallelism()`
  - `ioLimit = (UV_THREADPOOL_SIZE || 4) * 2`
  - `hardCap = 32`
  - `suggestedMaxJobs = min(cpuLimit, ioLimit, hardCap)`
- [ ] Add tests for standalone success and conflict failure.
- [ ] Add CLI help text and README usage example.

### Phase 3 - Benchmark and Release Validation

- [ ] Add benchmark script (for local verification), proposed:
  - `scripts/benchmark-batch-jobs.mjs`
- [ ] Use `examples/manage-huge-logs.mjs` fixture workflow for reproducible large datasets.
- [ ] Run benchmark matrix (`--jobs 1,2,4,8`) with low-noise command settings:
  - `--format raw --quiet-skips --no-progress`
- [ ] Record median/p95 timing plus result parity checks in a job record.
- [ ] Final regression: `bun test`
- [ ] Final regression: targeted CLI smoke checks for `--jobs`, `--print-jobs-limit`

## Execution Notes

- Keep rollout compatibility-first: no behavior change unless new flags are used.
- Prioritize deterministic output guarantees before throughput optimization claims.
- Keep full `doctor` command out of this release; `--print-jobs-limit` is the minimal diagnostics bridge.

## Related Research

- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`
- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-13-cli-progress-indicator.md`
