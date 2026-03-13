---
title: "doctor command implementation"
created-date: 2026-03-13
modified-date: 2026-03-13
status: completed
agent: Codex
---

## Goal

Implement the planned `doctor` subcommand and keep its runtime diagnostics, output contract, tests, and docs aligned with the completed research and implementation plan.

## What Changed

- Added the new doctor diagnostics modules:
  - `src/cli/doctor/checks.ts`
  - `src/cli/doctor/render.ts`
  - `src/cli/doctor/run.ts`
  - `src/cli/doctor/types.ts`
- Wired `word-counter doctor` as a dedicated subcommand in `src/command.ts`.
- Implemented doctor runtime checks for:
  - embedded package version and derived build channel
  - Node.js support-policy status against `>=20`
  - `Intl.Segmenter` availability, constructor health, and sample segmentation
  - batch jobs host limits via `resolveBatchJobsLimit()`
  - worker-route env toggles and preflight availability signals
- Added worker-route preflight helpers shared with the existing jobs code:
  - exported worker entry resolution from `src/cli/batch/jobs/worker-pool.ts`
  - added `resolveWorkerRoutePreflight()` in `src/cli/batch/jobs/load-count-worker.ts`
- Added doctor command coverage in `test/command.test.ts` for:
  - default text output
  - compact and pretty JSON output
  - `ok` / `warn` / `fail` exit-code behavior
  - invalid doctor usage
  - jobs/worker diagnostics parity
  - root command regressions after subcommand wiring
- Updated user-facing docs:
  - `README.md`
  - `docs/researches/research-2026-03-13-doctor-command.md`
- Marked `docs/plans/plan-2026-03-13-doctor-command-implementation.md` completed and checked all task items.

## Validation

- `bun run type-check`
- `bun test test/command.test.ts`
- `bun test`
- `bun run build`

## Related Research

- `docs/researches/research-2026-03-13-doctor-command.md`

## Related Plans

- `docs/plans/plan-2026-03-13-doctor-command-implementation.md`
