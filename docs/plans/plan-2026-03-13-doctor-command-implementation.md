---
title: "Doctor command implementation"
created-date: 2026-03-13
modified-date: 2026-03-13
status: completed
agent: Codex
---

## Goal

Implement a focused `doctor` subcommand that reports whether the current host can run `word-counter` reliably, with `Intl.Segmenter` health as the primary runtime gate and existing jobs diagnostics reused where possible.

## Scope

- In scope:
  - Add `word-counter doctor` as a dedicated subcommand.
  - Support human-readable output by default.
  - Support JSON output via `--format json`, with `--pretty` controlling indentation.
  - Report runtime summary, `Intl.Segmenter` health, batch jobs limits, and worker-route preflight signals.
  - Return stable top-level status (`ok` / `warn` / `fail`) and matching exit codes.
  - Add command tests and documentation updates.
- Out of scope:
  - Benchmarking or performance profiling.
  - Filesystem permission checks.
  - Network, registry, or config-file diagnostics.
  - WASM or statistical language-detection experiments.
  - Changes to counting semantics or existing counting command flows.

## Phase Task Items

### Phase 1 - CLI Surface and Module Layout

- [x] Add a dedicated `doctor` subcommand in `src/command.ts` rather than another standalone top-level flag.
- [x] Keep doctor wiring isolated from count execution so existing count flows and standalone `--print-jobs-limit` validation remain unchanged.
- [x] Add a small doctor module boundary, proposed:
  - `src/cli/doctor/run.ts`
  - `src/cli/doctor/checks.ts`
  - `src/cli/doctor/render.ts`
  - `src/cli/doctor/types.ts`
- [x] Define doctor-local option parsing for:
  - default human-readable output
  - `--format json`
  - `--pretty` as JSON indentation control
- [x] Explicitly constrain the doctor option surface so v1 accepts only its intended diagnostics options:
  - reject unsupported output modes such as `--format raw`
  - reject counting inputs and batch/path flags
  - reject inherited count/debug-only flags that are not part of the doctor contract
- [x] Decide how doctor invalid usage maps to exit code `1` while preserving Commander-style error output.

### Phase 2 - Runtime and Capability Checks

- [x] Implement runtime summary fields:
  - `packageVersion`
  - `buildChannel`
  - `requiredNodeRange`
  - `nodeVersion`
  - `meetsProjectRequirement`
  - `platform`
  - `arch`
- [x] Reuse embedded-version sourcing instead of reading `package.json` at doctor runtime.
- [x] Add a simple build-channel derivation (`stable` / `canary`) from the embedded version string.
- [x] Add an explicit Node support-policy check against the current project contract (`>=20`).
- [x] Implement `Intl.Segmenter` checks for:
  - availability
  - word granularity constructor health
  - grapheme granularity constructor health
  - sample segmentation iteration without throwing
- [x] Treat missing or unusable `Intl.Segmenter` as the primary `fail` condition.

### Phase 3 - Jobs and Worker Diagnostics

- [x] Reuse `resolveBatchJobsLimit()` for doctor jobs diagnostics so `doctor` and `--print-jobs-limit` stay aligned.
- [x] Report jobs diagnostics fields:
  - `cpuLimit`
  - `uvThreadpool`
  - `ioLimit`
  - `suggestedMaxJobs`
- [x] Report worker-route env toggles:
  - `WORD_COUNTER_DISABLE_WORKER_JOBS`
  - `WORD_COUNTER_DISABLE_EXPERIMENTAL_WORKERS`
- [x] Add worker preflight signals that map to real fallback paths in current code:
  - `workerThreadsAvailable`
  - `workerRouteDisabledByEnv`
  - `workerPoolModuleLoadable`
  - `workerEntryFound`
- [x] Refactor or expose any worker preflight helper needed so doctor does not duplicate fragile worker-entry resolution logic.
- [x] Keep doctor side-effect free by avoiding real worker task execution.

### Phase 4 - Rendering, Status, and Exit Codes

- [x] Add human-readable doctor rendering with sectioned output for:
  - runtime
  - segmenter
  - batch jobs
  - worker route
- [x] Use `picocolors` for human-readable emphasis when color is supported.
- [x] Keep JSON output uncolored and stable.
- [x] Keep JSON formatting aligned with the existing CLI contract:
  - `--format json` prints compact JSON
  - `--format json --pretty` prints indented JSON
- [x] Lock the v1 JSON payload shape to the researched contract, including:
  - top-level `status`
  - `runtime`, `segmenter`, `jobs`, and `workerRoute` sections
  - `warnings` as a stable top-level array
- [x] Implement top-level status reduction:
  - `ok` when essential checks pass without advisory degradation
  - `warn` when essential checks pass with advisory warnings
  - `fail` when essential runtime capability is missing
- [x] Implement exit codes:
  - `0` for `ok` and `warn`
  - `1` for invalid usage
  - `2` for `fail`

### Phase 5 - Tests and Documentation

- [x] Add command tests in `test/command.test.ts` for:
  - default human-readable doctor output
  - `doctor --format json`
  - `doctor --format json --pretty`
  - failure exit path when `Intl.Segmenter` is unavailable or unusable
  - advisory warning path when runtime policy fails but essential capability checks still pass
- [x] Add explicit assertions for doctor exit-code contracts:
  - `0` for `ok`
  - `0` for `warn`
  - `1` for invalid doctor usage
  - `2` for runtime `fail`
- [x] Add payload-shape tests for the researched JSON contract so field names and section layout do not drift during implementation.
- [x] Add coverage for jobs and worker diagnostics parity with current helpers and env toggles.
- [x] Add tests that doctor remains isolated from counting inputs and batch path flags.
- [x] Add regression tests that existing root CLI behavior remains intact after introducing the subcommand:
  - counting flows still parse and execute correctly
  - `--print-jobs-limit` still works as a standalone root diagnostic
  - standalone validation for `--print-jobs-limit` is unchanged
- [x] Update `README.md` with doctor usage examples and JSON-formatting expectations.
- [x] Update any existing diagnostics docs that currently point only to `--print-jobs-limit` as the future bridge.
- [x] Record implementation work in follow-up job records as phases are completed.

## Execution Notes

- Keep v1 intentionally narrow: runtime capability and diagnostics only.
- Prefer reusing current helpers and exporting small shared utilities over duplicating logic inside doctor-specific modules.
- Preserve current CLI behavior outside the new subcommand.
- Treat the JSON payload as an automation-facing contract and avoid adding incidental environment-specific fields unless they are clearly needed.
- Make the allowed doctor option surface explicit early so inherited root options do not accidentally become part of the public contract.

## Related Research

- `docs/researches/research-2026-03-13-doctor-command.md`
- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`
