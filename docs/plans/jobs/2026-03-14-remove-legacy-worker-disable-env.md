---
title: "remove legacy worker disable env"
created-date: 2026-03-14
status: completed
agent: Codex
---

## Goal

Remove the legacy `WORD_COUNTER_DISABLE_EXPERIMENTAL_WORKERS` environment-variable alias and keep the worker-route diagnostics contract focused on the current `WORD_COUNTER_DISABLE_WORKER_JOBS` setting.

## What Changed

- Removed runtime support for `WORD_COUNTER_DISABLE_EXPERIMENTAL_WORKERS` from `src/cli/batch/jobs/load-count-worker.ts`.
- Simplified doctor worker-route diagnostics to expose only:
  - `workerThreadsAvailable`
  - `workerRouteDisabledByEnv`
  - `disableWorkerJobsEnv`
  - `workerPoolModuleLoadable`
  - `workerEntryFound`
- Updated tests and user-facing docs to use only `WORD_COUNTER_DISABLE_WORKER_JOBS`.
- Updated the doctor research document so the proposed diagnostics contract matches the current implementation.

## Validation

- `bun run type-check`
- `bun test test/command.test.ts --filter "CLI doctor diagnostics"`
- `bun run build`

## Related Research

- `docs/researches/research-2026-03-13-doctor-command.md`

## Related Plans

- `docs/plans/plan-2026-03-13-doctor-command-implementation.md`
