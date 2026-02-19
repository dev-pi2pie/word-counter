---
title: "Batch jobs concurrency and diagnostics"
created-date: 2026-02-19
modified-date: 2026-02-19
status: draft
agent: Codex
---

## Goal

Deliver a focused improvement set that improves large-batch runtime via bounded concurrency and practical host diagnostics, with a stable default route and a separate experimental route, without changing counting semantics.

## Scope

- In scope:
  - `--jobs <n>` bounded concurrency in batch mode (stable load-only route).
  - Experimental `load+count` route behind explicit opt-in.
  - Modularized jobs architecture (strategy + route executors + shared primitives).
  - Standalone `--print-jobs-limit` diagnostics flag.
  - Benchmark and parity validation for deterministic behavior.
- Out of scope:
  - WASM/statistical language detection.
  - Full `doctor` subcommand.

## Phase Task Items

### Phase 1 - Stable Route (`load-only`)

- [x] Add `--jobs <n>` CLI option with validation (`integer >= 1`, no hard max cap).
- [x] Keep default `--jobs=1` for compatibility-safe rollout.
- [x] Implement bounded load concurrency with deterministic single-threaded count/aggregate.
- [x] Preserve deterministic output via original sorted index before finalize/render.
- [x] Keep JSON/standard/raw contracts unchanged.
- [x] Ensure progress and debug behavior remain consistent under concurrent completion.
- [x] Add tests for deterministic per-file order and total parity across `--jobs` values.

### Phase 2 - Modular Architecture

- [x] Add shared executor contract and route selector:
  - `src/cli/batch/jobs/types.ts`
  - `src/cli/batch/jobs/strategy.ts`
- [x] Add stable executor and shared queue/render/limits modules:
  - `src/cli/batch/jobs/load-only.ts`
  - `src/cli/batch/jobs/queue.ts`
  - `src/cli/batch/jobs/render.ts`
  - `src/cli/batch/jobs/limits.ts`
- [x] Keep CLI wiring thin so route logic is not concentrated in one file.

### Phase 3 - Experimental Route (`load+count`)

- [x] Add explicit experimental opt-in flag for `load+count` route.
- [x] Implement experimental executor in `src/cli/batch/jobs/load-count-experimental.ts`.
- [x] Reuse shared contracts/primitives from Phase 2 (no special-case fork in CLI layer).
- [x] Add parity tests vs stable route for deterministic output and totals.
- [x] Add safety checks for resource-limit failures (`EMFILE`/`ENFILE`) with clear failure messages.

### Phase 4 - Diagnostics: `--print-jobs-limit`

- [ ] Add standalone `--print-jobs-limit` flag.
- [ ] Enforce standalone-only usage (reject with non-zero when combined with other runtime flags or inputs).
- [ ] Output a single JSON object to `stdout` with:
  - `suggestedMaxJobs`
  - `cpuLimit`
  - `uvThreadpool`
  - `ioLimit`
- [ ] Implement heuristic:
  - `cpuLimit = os.availableParallelism()`
  - `ioLimit = (UV_THREADPOOL_SIZE || 4) * 2`
  - `suggestedMaxJobs = min(cpuLimit, ioLimit)`
- [ ] Warn when requested `--jobs` is higher than `suggestedMaxJobs` (advisory, not hard reject).
- [ ] Add tests for standalone success and conflict failure.
- [ ] Add CLI help text and README usage example.

### Phase 5 - Benchmark and Release Validation

- [ ] Add benchmark script (for local verification), proposed:
  - `scripts/benchmark-batch-jobs.mjs`
- [ ] Use `examples/manage-huge-logs.mjs` fixture workflow for reproducible large datasets.
- [ ] Run benchmark matrix for stable and experimental routes (`--jobs 1,2,4,8`) with low-noise command settings:
  - `--format raw --quiet-skips --no-progress`
- [ ] Record median/p95 timing plus parity checks in a job record.
- [ ] Final regression: `bun test`
- [ ] Final regression: targeted CLI smoke checks for stable route, experimental route, and `--print-jobs-limit`.

## Execution Notes

- Keep rollout compatibility-first: no behavior change unless new flags are used.
- Prioritize deterministic output guarantees before throughput optimization claims.
- Ship stable route first; keep experimental route clearly marked and opt-in.
- Keep full `doctor` command out of this release; `--print-jobs-limit` is the minimal diagnostics bridge.

## Related Research

- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`
- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-13-cli-progress-indicator.md`
