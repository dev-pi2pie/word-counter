---
title: "Batch jobs concurrency and diagnostics"
created-date: 2026-02-19
modified-date: 2026-02-20
status: draft
agent: Codex
---

## Goal

Deliver a focused improvement set that improves large-batch runtime via bounded concurrency and practical host diagnostics, with `--jobs` as the single concurrency control (`jobs=1` no extra workers, `jobs>1` worker `load+count`), without changing counting semantics.

## Scope

- In scope:
  - `--jobs <n>` bounded concurrency in batch mode as the only concurrency UX control.
  - Worker `load+count` execution when `--jobs > 1`.
  - No-worker baseline when `--jobs` is omitted or `--jobs=1`.
  - Removal of redundant `--experimental-load-count` flag from CLI UX.
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

### Phase 4 - Experimental Route v2 (`worker_threads`)

- [x] Add worker-pool infrastructure for counting:
  - `src/cli/batch/jobs/worker/protocol.ts`
  - `src/cli/batch/jobs/worker/count-worker.ts`
  - `src/cli/batch/jobs/worker-pool.ts`
- [x] Add executor `src/cli/batch/jobs/load-count-worker-experimental.ts` using bounded worker dispatch.
- [x] Keep deterministic output ordering via index-stable result slots.
- [x] Define explicit strategy behavior:
  - prefer worker route when `--jobs > 1` and workers are available
  - fallback to current async experimental route on unsupported environments
- [x] Add worker failure handling (worker crash/init error/message protocol mismatch) with clear surfaced errors.
- [x] Add parity tests vs stable route for:
  - totals
  - per-file ordering
  - sectioned and non-sectioned output contracts
- [x] Add targeted performance acceptance check:
  - benchmark profile should show meaningful median speedup vs stable `--jobs 1` baseline when `--jobs 4` is used.

### Phase 5 - Strategy Consolidation (`--jobs` only)

- [x] Remove `--experimental-load-count` from CLI options and help text.
- [x] Update route selection policy:
  - `--jobs` omitted or `--jobs=1` -> no extra workers
  - `--jobs>1` -> worker `load+count` route by default
- [x] Keep async executor as internal fallback only (not user-facing route).
- [x] Remove/adjust tests that depend on explicit experimental flag behavior.
- [x] Add tests for policy behavior:
  - default path (no `--jobs`) equals `--jobs=1`
  - `--jobs>1` uses worker executor (with fallback diagnostics when unavailable)
  - parity across sectioned and non-sectioned outputs
- [x] Update research/README/help text to reflect unified `--jobs` policy.

### Phase 6 - Diagnostics: `--print-jobs-limit`

- [x] Add standalone `--print-jobs-limit` flag.
- [x] Enforce standalone-only usage (reject with non-zero when combined with other runtime flags or inputs).
- [x] Output a single JSON object to `stdout` with:
  - `suggestedMaxJobs`
  - `cpuLimit`
  - `uvThreadpool`
  - `ioLimit`
- [x] Implement heuristic:
  - `cpuLimit = os.availableParallelism()`
  - `ioLimit = (UV_THREADPOOL_SIZE || 4) * 2`
  - `suggestedMaxJobs = min(cpuLimit, ioLimit)`
- [x] Warn when requested `--jobs` is higher than `suggestedMaxJobs` and apply a safety cap to effective jobs (no hard reject).
- [x] Add tests for standalone success and conflict failure.
- [x] Add CLI help text and README usage example.
- [x] Add guardrail helper to clamp requested jobs to host suggested limit.
- [x] Keep over-limit warning styling consistent with skip diagnostics (yellow terminal warning).

Phase 6 related job records:

- `docs/plans/jobs/2026-02-19-batch-jobs-phase1-3-implementation.md`
- `docs/plans/jobs/2026-02-19-jobs-limit-guardrail.md`
- `docs/plans/jobs/2026-02-19-phase6-diagnostics-checklist-alignment.md`

### Phase 7 - Benchmark and Release Validation

- [x] Route cleanup: remove active `load-only` route usage and keep only `load+count` family (`jobs=1` async baseline, `jobs>1` worker route with internal fallback).
- [x] Internal naming cleanup: remove `experimental` wording from active route module filenames/imports.
- [x] Diagnostics sub-plan execution: implement unified noise policy (error/warning/debug tiers), warning suppression option, and `--quiet-skips` contract alignment.
- [x] Update breaking-change tracking for diagnostics contract updates:
  - `docs/breaking-changes-notes.md`
- [x] Track and execute sub-plan:
  - `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`
- [x] Benchmark protocol is documented in:
  - `docs/batch-jobs-usage-guide.md`
  - includes fixture workflow (`examples/manage-huge-logs.mjs`), benchmark matrix (`--jobs 1,2,4,8`), and acceptance criteria (median/p95 + parity).
- [x] Add benchmark script (for local verification), proposed:
  - `scripts/benchmark-batch-jobs.mjs`
- [x] Re-run benchmark matrix for unified jobs policy (`--jobs 1,2,4,8`) with low-noise command settings after route/logging cleanup:
  - `--format raw --quiet-skips --no-progress`
- [x] Record refreshed median/p95 timing plus parity checks in a new job record.
- [x] Final regression: `bun test`
- [x] Final regression: targeted CLI smoke checks for `--jobs` policy and `--print-jobs-limit`.

Phase 7 related job records:

- `docs/plans/jobs/2026-02-20-batch-jobs-route-cleanup-and-noise-policy.md`
- `docs/plans/jobs/2026-02-20-batch-jobs-phase7-benchmark-refresh.md`

## Execution Notes

- Keep rollout compatibility-first: no behavior change unless new flags are used.
- Prioritize deterministic output guarantees before throughput optimization claims.
- Keep `--jobs` as the only user-facing concurrency switch.
- Treat previous explicit experimental flag behavior as transitional and remove it in Phase 5.
- Keep full `doctor` command out of this release; `--print-jobs-limit` is the minimal diagnostics bridge.

## Related Research

- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`
- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-13-cli-progress-indicator.md`

## Related Plans

- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`
