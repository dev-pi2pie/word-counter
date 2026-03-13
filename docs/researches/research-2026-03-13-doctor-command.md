---
title: "Doctor command for runtime capability checks"
created-date: 2026-03-13
modified-date: 2026-03-13
status: draft
agent: Codex
---

## Goal

Define a low-risk `doctor` command that helps users verify whether the current host can run `word-counter` reliably, with `Intl.Segmenter` support treated as an essential runtime check.

## Milestone Goal

Provide an implementation-ready direction for a diagnostics surface that reduces support/debug friction without changing counting behavior or pulling in WASM-based language detection.

## Key Findings

- The CLI currently exposes one standalone diagnostics entrypoint, `--print-jobs-limit`, which reports host concurrency heuristics for batch mode.
- Existing docs already describe `--print-jobs-limit` as a lightweight bridge before a fuller `doctor` command.
- The project already has an explicit runtime requirement of Node.js `>=20` in `package.json` and `README.md`; doctor should report that requirement directly instead of assuming users know it.
- `Intl.Segmenter` is a hard dependency for the core word-counting path and the preferred path for grapheme-aware character counting.
- Node.js support for `Intl.Segmenter` predates this project's runtime floor; a practical baseline is Node.js `16.0.0` (released 2021-04-20), inferred from Node 16 shipping V8 `9.0.257.17` and ICU `69.1`, where `Intl.Segmenter` support is available in practice. This historical note is useful context, but doctor should validate the runtime directly rather than rely on version alone.
- Node.js internationalization support can vary by ICU build mode (`none`, `system-icu`, `small-icu`, `full-icu`), so runtime capability checks remain necessary even when the Node version is new enough.
- The codebase already has a small runtime capability seam for segmentation in `src/wc/segmenter.ts`:
  - word counting constructs `new Intl.Segmenter(locale, { granularity: "word" })`
  - char counting prefers `new Intl.Segmenter(locale, { granularity: "grapheme" })`
  - char mode falls back to `Array.from(text)` only when `Intl.Segmenter` is unavailable
- Batch diagnostics already expose reusable host signals:
  - `os.availableParallelism()`
  - `UV_THREADPOOL_SIZE`
  - derived `suggestedMaxJobs`
- There are also hidden environment controls that affect runtime behavior and are useful to surface in diagnostics:
  - `WORD_COUNTER_DISABLE_WORKER_JOBS`
  - `WORD_COUNTER_DISABLE_EXPERIMENTAL_WORKERS`

## Proposed Direction

Prefer a dedicated subcommand:

```bash
word-counter doctor
```

Why a subcommand instead of `--doctor`:

- It avoids awkward standalone-flag validation similar to `--print-jobs-limit`.
- It gives room for doctor-specific output modes later without mixing with counting flags.
- It reads naturally as an operational command rather than a counting modifier.

## Proposed Scope for v1

In scope:

- Verify essential runtime capability for `Intl.Segmenter`
- Report batch jobs host limits
- Report worker-route availability signals
- Report key environment toggles that affect runtime behavior
- Offer a machine-readable JSON mode

Out of scope:

- Benchmarking
- Filesystem permission probes
- Network/package-registry checks
- Config-file linting
- WASM/statistical language detection

## Proposed Checks

### 1. Runtime Summary

Purpose:

- Confirm the basic host/runtime shape before deeper checks.

Suggested fields:

- `packageVersion`
- `buildChannel`
- `nodeVersion`
- `requiredNodeRange`
- `meetsProjectRequirement`
- `platform`
- `arch`

Recommended interpretation:

- `packageVersion` should come from the embedded build-time version source (`src/cli/program/version-embedded.ts`), not from runtime `package.json` lookup.
- `buildChannel` can be derived from the embedded version string for a simple v1 classification such as `stable` or `canary`.
- `requiredNodeRange` should come from the project contract (`>=20` today).
- `meetsProjectRequirement` should be a straightforward semver check against the current runtime.
- Failing the project requirement should be reported clearly even if some lower-version runtimes might still expose `Intl.Segmenter`.
- Keep the stable v1 JSON payload focused on runtime identity and support policy; omit `cwd` so the contract stays smaller and less environment-specific.

### 2. `Intl.Segmenter` Health

Purpose:

- This is the most important doctor check because the project is explicitly built around `Intl.Segmenter`.

Recommended v1 checks:

- `available`: `typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"`
- `wordGranularity`: can construct `new Intl.Segmenter("en", { granularity: "word" })`
- `graphemeGranularity`: can construct `new Intl.Segmenter("en", { granularity: "grapheme" })`
- `sampleWordSegmentation`: segment a short mixed sample and confirm iteration works without throwing

Notes:

- The goal is runtime capability verification, not linguistic correctness auditing.
- If `Intl.Segmenter` is missing, doctor should treat that as a hard failure.
- This check is distinct from the project's Node version requirement:
  - Node version answers "is this runtime within supported policy?"
  - `Intl.Segmenter` health answers "can the essential segmentation engine actually run here?"

### 3. Batch Jobs Host Limits

Purpose:

- Reuse the existing jobs-limit logic instead of inventing a second diagnostics path.

Suggested fields:

- `cpuLimit`
- `uvThreadpool`
- `ioLimit`
- `suggestedMaxJobs`

Implementation note:

- Reuse `resolveBatchJobsLimit()` so doctor and `--print-jobs-limit` stay aligned.

### 4. Worker Route Signals

Purpose:

- Explain why `--jobs > 1` may not actually use the worker route.

Suggested fields:

- `workerThreadsAvailable`
- `workerRouteDisabledByEnv`
- `disableWorkerJobsEnv`
- `disableExperimentalWorkersEnv`
- `workerPoolModuleLoadable`
- `workerEntryFound`

Notes:

- In v1, keep this to capability/toggle reporting.
- This section should explain the real fallback paths visible in the current code:
  - env-based disable switches
  - failure to load the worker-pool module
  - missing worker entry file resolution
- Avoid full end-to-end worker task execution unless a real bug proves it is necessary; doctor can still surface the preflight availability checks above.

### 5. Overall Status

Purpose:

- Give users one top-level answer for automation and support triage.

Suggested status model:

- `ok`: essential checks pass
- `warn`: essential checks pass, but advisory degradations exist
- `fail`: essential runtime capability is missing

Suggested exit codes:

- `0`: `ok` or `warn`
- `1`: invalid doctor usage
- `2`: `fail`

## Proposed Output Contract

### Standard Output

Human-readable summary, for example:

```text
Doctor: warn

Runtime
- package: 0.1.5-canary.1 (canary)
- node: v22.14.0
- platform: darwin arm64

Segmenter
- Intl.Segmenter: available
- word granularity: ok
- grapheme granularity: ok

Batch jobs
- cpuLimit: 10
- uvThreadpool: 4
- suggestedMaxJobs: 8

Worker route
- worker threads: available
- disabled by env: no
```

Presentation note:

- Standard doctor output should use `picocolors` for status emphasis and section labels when the terminal supports color.
- When color is unavailable or disabled, output should remain fully readable as plain text.
- JSON output must remain uncolored.

### JSON Output

Recommended automation shape:

```json
{
  "status": "warn",
  "runtime": {
    "packageVersion": "0.1.5-canary.1",
    "buildChannel": "canary",
    "requiredNodeRange": ">=20",
    "nodeVersion": "v22.14.0",
    "meetsProjectRequirement": true,
    "platform": "darwin",
    "arch": "arm64"
  },
  "segmenter": {
    "available": true,
    "wordGranularity": true,
    "graphemeGranularity": true
  },
  "jobs": {
    "cpuLimit": 10,
    "uvThreadpool": 4,
    "ioLimit": 8,
    "suggestedMaxJobs": 8
  },
  "workerRoute": {
    "workerThreadsAvailable": true,
    "workerRouteDisabledByEnv": false,
    "disableWorkerJobsEnv": null,
    "disableExperimentalWorkersEnv": null
  },
  "warnings": []
}
```

## UX Recommendation

Recommended commands:

- `word-counter doctor`
- `word-counter doctor --format json`
- `word-counter doctor --format json --pretty`

Behavior contract:

- `doctor` should not accept counting inputs or batch path flags.
- `doctor` should be self-contained and side-effect free.
- default output should be human-readable text lines.
- default human-readable output should use `picocolors` when terminal color support is available.
- `doctor --format json` should print one JSON object to `stdout`.
- `doctor --format json --pretty` should indent JSON, matching the existing CLI-wide `--pretty` contract.

## Why This Is Worth Doing Now

- It addresses a real support/debug gap without changing counting semantics.
- It lets users distinguish between:
  - unsupported Node.js version for this project
  - supported Node.js version but unusable `Intl.Segmenter` runtime capability
- It gives users a clear answer when their host lacks `Intl.Segmenter`, which is essential for the project’s main value proposition.
- It consolidates diagnostics that are currently split between hidden environment behavior and `--print-jobs-limit`.
- It can expose the current embedded package version users are actually running, which matters for canary support/debug conversations.
- It creates a cleaner future home for config/env inspection if config support lands later.

## Risks

- A doctor command can grow into an unbounded catch-all.
  - Mitigation: keep v1 focused on runtime capability, segmentation, and jobs/worker signals only.
- Over-checking can create false alarms.
  - Mitigation: treat only missing `Intl.Segmenter` or failed segmenter construction as hard failures.
- A subcommand adds CLI structure where current UX is mostly flag-based.
  - Mitigation: keep doctor isolated and avoid changing existing counting flows.

## Implications or Recommendations

- Implement `doctor` as a subcommand, not a standalone flag.
- Split doctor's runtime reporting into:
  - project support policy (`requiredNodeRange`, `meetsProjectRequirement`)
  - actual segmentation capability (`Intl.Segmenter` availability + constructor checks)
- Default `doctor` to human-readable text output; support pretty JSON only when `--format json` is explicitly requested.
- Keep JSON formatting aligned with the rest of the CLI:
  - `--format json` for compact machine-readable output
  - `--format json --pretty` for indented output
- Follow existing CLI styling conventions by using `picocolors` for human-readable doctor output when color is supported.
- Report the current embedded package version in v1, using `src/cli/program/version-embedded.ts` as the source of truth.
- Treat `Intl.Segmenter` availability and constructor health as the primary doctor outcome.
- Reuse current jobs-limit helpers so there is one source of truth for batch diagnostics.
- Surface both user-visible env effects and the worker preflight signals that match current fallback behavior in doctor output.
- Keep the first version automation-friendly with a stable JSON output.
- Do not fold WASM or deeper language-detection experiments into this scope.

## Decisions (2026-03-13)

1. `doctor` defaults to human-readable text output.
2. `doctor --format json` follows the existing CLI JSON contract: compact by default, pretty only with `--pretty`.
3. `doctor` should report the current package version from `src/cli/program/version-embedded.ts`.
4. `doctor` may also expose a simple derived build channel (`canary` / `stable`) based on the embedded version string.
5. `doctor` should surface both implemented env-driven behavior and the worker preflight signals that map to current fallback paths.
6. Human-readable doctor output should use `picocolors` when terminal color support is available; JSON output stays plain.

## Related Research

- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`
- `docs/researches/research-2026-01-02-word-counter-options.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`

## References

- `package.json`
- `README.md`
- `src/command.ts`
- `src/cli/program/version-embedded.ts`
- `src/cli/program/options.ts`
- `src/cli/runtime/options.ts`
- `src/cli/batch/jobs/limits.ts`
- `src/cli/batch/jobs/load-count-worker.ts`
- `src/cli/batch/jobs/worker-pool.ts`
- `src/wc/segmenter.ts`
