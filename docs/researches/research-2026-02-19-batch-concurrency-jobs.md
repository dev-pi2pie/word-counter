---
title: "Batch concurrency via --jobs"
created-date: 2026-02-19
modified-date: 2026-02-19
status: draft
agent: Codex
---

## Goal

Define a low-risk concurrency design for batch counting that improves runtime on large file sets while preserving deterministic output and existing CLI contracts.

## Scope

In scope:
- Batch mode only (`--path` flows)
- Bounded concurrency via `--jobs <n>`
- Benchmark protocol and acceptance criteria

Out of scope:
- WASM/statistical language detection
- Config-file persistence
- Changing default counting semantics

## Current State

- File loading is sequential in `src/cli/path/load.ts`.
- File counting/aggregation is sequential in `src/cli/batch/aggregate.ts`.
- Path resolution is deterministic and sorted before load/count in `src/cli/path/resolve.ts`.

This is stable but leaves performance on the table for large directory scans.

## Proposed Route

1. Add `--jobs <n>` (batch-only), validated as integer `>= 1`.
2. Default to `1` (opt-in concurrency for safest rollout).
3. First release: parallelize load only with bounded prefetching; keep count/aggregate deterministic and single-threaded.
4. Add an experimental route for `load+count` in workers, gated behind an explicit experiment flag.
5. Preserve output determinism by writing each result into its original sorted index.
6. Keep skip/error behavior unchanged for this scope.

## Modular Two-Route Design

Default route (stable):
- `load-only` concurrency (`--jobs`) with single-threaded count/aggregate.

Experimental route:
- `load+count` inside workers, enabled only with an explicit experimental option.

Module boundaries (keep files small and composable):
- `src/cli/batch/jobs/strategy.ts`: route selection and shared contracts.
- `src/cli/batch/jobs/load-only.ts`: stable executor.
- `src/cli/batch/jobs/load-count-experimental.ts`: experimental executor.
- `src/cli/batch/jobs/queue.ts`: bounded queue/backpressure primitive.
- `src/cli/batch/jobs/types.ts`: task/result/error event types.
- `src/cli/batch/jobs/limits.ts`: host limit heuristic + warnings.
- `src/cli/batch/jobs/render.ts`: deterministic finalize/render from index-ordered results.

Guardrail:
- Both routes must implement the same executor interface so CLI wiring and output contracts stay identical.

## ASCII Diagram

```text
Current (sequential)
--------------------
[resolved files sorted]
          |
          v
   load file #1 -> count #1 -> aggregate
          |
          v
   load file #2 -> count #2 -> aggregate
          |
          v
        ...repeat...


Proposed v1 (bounded load concurrency with stable output order)
---------------------------------------------------------------
           [resolved files sorted]
                      |
                      v
            [index-based task queue]
             /         |          \
            v          v           v
      loader A     loader B    loader C   ... up to --jobs
      load only    load only    load only
            \          |           /
             v         v          v
     [loaded buffers written by original index]
                      |
                      v
      [single deterministic count + aggregate pass]
                      |
                      v
         [single deterministic finalize/render]


Experimental route (bounded load+count workers, explicit opt-in)
----------------------------------------------------------------
           [resolved files sorted]
                      |
                      v
            [index-based task queue]
             /         |          \
            v          v           v
      worker A     worker B    worker C   ... up to --jobs
      load+count   load+count   load+count
            \          |           /
             v         v          v
      [counted results written by original index]
                      |
                      v
         [single deterministic finalize/render]
```

## Benchmark and Verification Plan

Dataset generator:
- `examples/manage-huge-logs.mjs`

Baseline dataset (fixed-size content to reduce noise):
- `node examples/manage-huge-logs.mjs reset 2000 400`

Benchmark command matrix (same dataset, repeated runs):
- `word-counter --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs 1`
- `word-counter --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs 2`
- `word-counter --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs 4`
- `word-counter --path ./examples/test-case-huge-logs --format raw --quiet-skips --no-progress --jobs 8`

Required checks:
- Runtime comparison: median and p95 wall time per `--jobs` value.
- Correctness parity: raw totals must match across all `--jobs`.
- Contract parity: standard/json output ordering remains deterministic.

Suggested acceptance target (for the default local benchmark profile):
- `--jobs 4` should show clear median speedup vs `--jobs 1` without output drift.

## Practical Limit Heuristic

Recommended `--jobs` advisory upper bound formula:

- `cpuLimit = os.availableParallelism()`
- `ioLimit = (UV_THREADPOOL_SIZE || 4) * 2`
- `suggestedMaxJobs = min(cpuLimit, ioLimit)`

Policy:
- Do not enforce a hard CLI validation cap.
- If requested `--jobs` exceeds `suggestedMaxJobs`, emit a warning and continue.
- If resource-limit failures occur (for example `EMFILE`/`ENFILE`), stop counting and exit with an explicit limit error.

How users can inspect host limits now:

```bash
ulimit -n
node -p "require('node:os').availableParallelism()"
node -p "process.env.UV_THREADPOOL_SIZE || 4"
```

One-command summary:

```bash
node -e "const os=require('node:os');const cpu=os.availableParallelism();const uv=Number(process.env.UV_THREADPOOL_SIZE||4);const max=Math.min(cpu,uv*2);console.log(JSON.stringify({cpu,uvThreadpool:uv,suggestedMaxJobs:max},null,2));"
```

## Proposed UX: `--print-jobs-limit`

Purpose:
- Provide a lightweight host diagnostics entrypoint before a full `doctor` subcommand.

Usage contract:
- `word-counter --print-jobs-limit`
- Must be standalone (no text input, no `--path`, and no other runtime flags).

Conflict policy:
- If combined with other operational flags, fail fast with:
  - `` `--print-jobs-limit` must be used alone. ``
- Exit status for invalid usage: `1`.

Output contract:
- Emit a single JSON object to `stdout` and exit:

```json
{
  "suggestedMaxJobs": 8,
  "cpuLimit": 10,
  "uvThreadpool": 4,
  "ioLimit": 8
}
```

Exit status:
- Successful print: `0`
- Invalid combination: `1`

CLI help text:
- `--print-jobs-limit  print suggested max --jobs for current host and exit`

## Risks and Mitigations

- Non-deterministic task completion order:
  - Mitigation: index-stable result slots, render after finalize only.
- Higher memory pressure at larger `--jobs`:
  - Mitigation: bounded queue/backpressure, warning on high requested jobs, document practical ranges.
- Progress/debug behavior drift:
  - Mitigation: keep event semantics unchanged; only update completion timing.

## Implications or Recommendations

- Proceed with opt-in concurrency first (`--jobs`, default `1`).
- Keep v1 implementation conservative: default route is load-only.
- Keep `load+count` as an explicitly experimental route until benchmark and stability criteria pass.
- Include benchmark tooling in-repo so performance claims are reproducible.
- Add `--print-jobs-limit` now as lightweight diagnostics; keep a fuller `doctor` command as follow-up.

## Decisions (2026-02-19)

1. `--jobs` is opt-in for this release (default `1`).
2. No hard max cap in CLI validation for now; prefer advisory guardrails and fail-fast on real resource-limit errors.
3. First version should default to load-only parallelism for stability, while a separate `load+count` route exists as explicit experimental mode.
4. Add `--print-jobs-limit` in this scope as the lightweight diagnostics option.

## Related Research

- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-13-cli-progress-indicator.md`
- `docs/researches/research-2026-02-17-filename-regex-matching.md`

## References

- `src/cli/path/load.ts`
- `src/cli/batch/aggregate.ts`
- `src/cli/path/resolve.ts`
- `examples/manage-huge-logs.mjs`
