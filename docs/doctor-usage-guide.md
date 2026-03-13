---
title: "Doctor Usage Guide"
created-date: 2026-03-14
status: completed
agent: Codex
---

# Doctor Usage Guide

## Goal

Explain what `word-counter doctor` reports, how to read each key/value in text mode, and how the JSON payload maps to the same diagnostics.

## Commands

```bash
word-counter doctor
word-counter doctor --format json
word-counter doctor --format json --pretty
```

## Status Values

| Status | Meaning | Exit code |
| --- | --- | --- |
| `ok` | Essential runtime checks passed and there are no advisory warnings. | `0` |
| `warn` | Essential runtime checks passed, but there are advisory warnings. | `0` |
| `fail` | Essential runtime capability is missing or unusable. | `2` |

Invalid doctor usage returns exit code `1`.

## Text Mode

Example:

```text
Doctor: warn

Runtime
- package: 0.1.5-canary.1 (canary)
- node: v22.14.0 (supported: yes; required >=20)
- platform: darwin arm64

Segmenter
- Intl.Segmenter: available
- word granularity: ok
- grapheme granularity: ok
- sample segmentation: ok

Batch jobs
- cpuLimit: 10
- uvThreadpool: 4
- ioLimit: 8
- suggestedMaxJobs: 8

Worker route
- worker threads: available
- disabled by env: no
- disableWorkerJobsEnv: null
- worker pool module: loadable
- worker entry: found
```

### Runtime Section

| Text key | Meaning | Typical values |
| --- | --- | --- |
| `package` | Embedded package version and derived release channel of the CLI you are actually running. | `0.1.5-canary.1 (canary)`, `0.1.5 (stable)` |
| `node` | Current Node.js runtime version plus whether it is within the supported project policy. | `v22.14.0 (supported: yes; required >=20)` |
| `platform` | Host OS platform and CPU architecture. | `darwin arm64`, `linux x64` |

### Segmenter Section

| Text key | Meaning | Good value | Problem value |
| --- | --- | --- | --- |
| `Intl.Segmenter` | Whether the runtime exposes the API at all. | `available` | `missing` |
| `word granularity` | Whether `new Intl.Segmenter(..., { granularity: "word" })` works. | `ok` | `fail` |
| `grapheme granularity` | Whether `new Intl.Segmenter(..., { granularity: "grapheme" })` works. | `ok` | `fail` |
| `sample segmentation` | Whether a simple segmentation pass can iterate without throwing. | `ok` | `fail` |

### Batch Jobs Section

| Text key | Meaning | Notes |
| --- | --- | --- |
| `cpuLimit` | Host CPU parallelism reported by `os.availableParallelism()`. | Upper bound used by jobs diagnostics. |
| `uvThreadpool` | Effective libuv threadpool size used for diagnostics. | Defaults to `4` unless `UV_THREADPOOL_SIZE` is set. |
| `ioLimit` | Derived I/O-oriented limit used by the jobs heuristic. | Calculated as `uvThreadpool * 2`. |
| `suggestedMaxJobs` | Recommended upper bound for `--jobs` on this host. | Calculated as `min(cpuLimit, ioLimit)`. |

### Worker Route Section

| Text key | Meaning | Typical values |
| --- | --- | --- |
| `worker threads` | Whether the current runtime can access `node:worker_threads`. | `available`, `missing` |
| `disabled by env` | Whether environment variables are forcing the worker route off. | `yes`, `no` |
| `disableWorkerJobsEnv` | Raw value of `WORD_COUNTER_DISABLE_WORKER_JOBS`. | `null`, `"1"` |
| `worker pool module` | Whether the internal worker-pool module can be loaded successfully. | `loadable`, `missing` |
| `worker entry` | Whether the worker entry file can be resolved from the current build/runtime layout. | `found`, `missing` |

### Interpreting `disabled by env`

| Value | Meaning |
| --- | --- |
| `yes` | At least one worker-disable environment variable is set to `"1"`. |
| `no` | The environment is not forcing the worker route off. This does not guarantee workers will be used; other worker-route checks still matter. |

The current env toggles are:

- `WORD_COUNTER_DISABLE_WORKER_JOBS`

## JSON Output

The JSON output reports the same diagnostics in machine-readable form.

| JSON field | Meaning |
| --- | --- |
| `status` | Top-level doctor outcome: `ok`, `warn`, or `fail`. |
| `runtime` | Runtime identity and support-policy fields. |
| `segmenter` | `Intl.Segmenter` health checks. |
| `jobs` | Batch jobs diagnostics aligned with `--print-jobs-limit`. |
| `workerRoute` | Worker-route preflight and env-toggle diagnostics. |
| `warnings` | Advisory warning messages collected during evaluation. |

### `runtime`

| Field | Meaning |
| --- | --- |
| `packageVersion` | Embedded package version. |
| `buildChannel` | Derived build channel: `stable` or `canary`. |
| `requiredNodeRange` | Supported Node.js range for the project. |
| `nodeVersion` | Current runtime version string. |
| `meetsProjectRequirement` | Whether the runtime satisfies the supported Node.js policy. |
| `platform` | Current OS platform. |
| `arch` | Current CPU architecture. |

### `segmenter`

| Field | Meaning |
| --- | --- |
| `available` | Whether `Intl.Segmenter` exists. |
| `wordGranularity` | Whether the word-granularity constructor works. |
| `graphemeGranularity` | Whether the grapheme-granularity constructor works. |
| `sampleWordSegmentation` | Whether a simple sample segmentation run completes without throwing. |

### `jobs`

| Field | Meaning |
| --- | --- |
| `cpuLimit` | CPU parallelism limit. |
| `uvThreadpool` | Effective libuv threadpool size. |
| `ioLimit` | Derived I/O limit. |
| `suggestedMaxJobs` | Recommended `--jobs` ceiling. |

### `workerRoute`

| Field | Meaning |
| --- | --- |
| `workerThreadsAvailable` | Whether `node:worker_threads` is available. |
| `workerRouteDisabledByEnv` | Whether env toggles force workers off. |
| `disableWorkerJobsEnv` | Raw `WORD_COUNTER_DISABLE_WORKER_JOBS` value or `null`. |
| `workerPoolModuleLoadable` | Whether the worker-pool module can be imported. |
| `workerEntryFound` | Whether the worker entry file can be resolved. |

## Troubleshooting

| Symptom | Likely meaning |
| --- | --- |
| `status: fail` with `Intl.Segmenter: missing` | The runtime cannot provide the core segmentation API required by the tool. |
| `status: warn` with `supported: no` | The runtime may still work, but it is outside the project’s supported Node.js policy. |
| `disabled by env: yes` | Your shell or process manager is forcing the worker route off. |
| `worker pool module: missing` | The worker-pool module could not be loaded in the current runtime/build layout. |
| `worker entry: missing` | The worker entry file was not found where the runtime expected it. |

## Related Research

- `docs/researches/research-2026-03-13-doctor-command.md`

## Related Plans

- `docs/plans/plan-2026-03-13-doctor-command-implementation.md`
