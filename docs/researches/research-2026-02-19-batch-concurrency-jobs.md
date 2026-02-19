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
3. Use a bounded worker-pool model (no unbounded `Promise.all`).
4. Preserve output determinism by writing each result into its original sorted index.
5. Keep skip/error behavior unchanged for this scope.

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


Proposed (bounded concurrency with stable output order)
-------------------------------------------------------
           [resolved files sorted]
                      |
                      v
            [index-based task queue]
             /         |          \
            v          v           v
      worker A     worker B    worker C   ... up to --jobs
      load+count    load+count   load+count
            \          |           /
             v         v          v
       [results written by original index]
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

Recommended `--jobs` upper bound formula:

- `cpuLimit = os.availableParallelism()`
- `ioLimit = (UV_THREADPOOL_SIZE || 4) * 2`
- `hardCap = 32`
- `suggestedMaxJobs = min(cpuLimit, ioLimit, hardCap)`

How users can inspect host limits now:

```bash
ulimit -n
node -p "require('node:os').availableParallelism()"
node -p "process.env.UV_THREADPOOL_SIZE || 4"
```

One-command summary:

```bash
node -e "const os=require('node:os');const cpu=os.availableParallelism();const uv=Number(process.env.UV_THREADPOOL_SIZE||4);const max=Math.min(cpu,uv*2,32);console.log(JSON.stringify({cpu,uvThreadpool:uv,suggestedMaxJobs:max},null,2));"
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
  "ioLimit": 8,
  "hardCap": 32
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
  - Mitigation: bounded queue, optional cap, document practical ranges.
- Progress/debug behavior drift:
  - Mitigation: keep event semantics unchanged; only update completion timing.

## Implications or Recommendations

- Proceed with opt-in concurrency first (`--jobs`, default `1`).
- Include benchmark tooling in-repo so performance claims are reproducible.
- Keep a `doctor`-style environment diagnostics command as a follow-up feature, not part of this core scope.

## Open Questions

- Should `--jobs` be exposed in this release as opt-in only, or auto-sized later?
- Do we want a hard max cap in CLI validation (for example `--jobs <= 32`)?
- Should the first version parallelize only load, or load+count together in workers?
- Do we want a lightweight diagnostics option (for example `--print-jobs-limit`) before adding a full `doctor` subcommand?

## Related Research

- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-13-cli-progress-indicator.md`
- `docs/researches/research-2026-02-17-filename-regex-matching.md`

## References

- `src/cli/path/load.ts`
- `src/cli/batch/aggregate.ts`
- `src/cli/path/resolve.ts`
- `examples/manage-huge-logs.mjs`
