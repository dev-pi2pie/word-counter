---
title: "doctor command implementation plan"
created-date: 2026-03-13
modified-date: 2026-03-13
status: completed
agent: Codex
---

## Goal

Create an implementation plan for the future `doctor` subcommand based on the completed research document and current CLI structure.

## What Changed

- Added `docs/plans/plan-2026-03-13-doctor-command-implementation.md`.
- Structured the plan into phased sections with checkbox task items covering:
  - CLI surface and module layout
  - runtime and `Intl.Segmenter` checks
  - jobs and worker diagnostics
  - rendering, status, and exit codes
  - tests and documentation
- Refined the plan after review to make four contracts explicit:
  - doctor must reject unsupported inherited/root options instead of silently inheriting them
  - the researched JSON payload shape must be locked and tested
  - existing root command behavior must get regression coverage after subcommand wiring
  - documented exit codes must be asserted directly in tests
- Linked the new plan from the doctor research doc for traceability.

## Validation

- Confirmed the new plan aligns with:
  - `docs/researches/research-2026-03-13-doctor-command.md`
  - `src/command.ts`
  - `src/cli/program/options.ts`
  - `src/cli/runtime/options.ts`
  - `src/cli/batch/jobs/limits.ts`
  - `src/cli/batch/jobs/load-count-worker.ts`
  - `src/cli/batch/jobs/worker-pool.ts`
  - `test/command.test.ts`

## Related Research

- `docs/researches/research-2026-03-13-doctor-command.md`

## Related Plans

- `docs/plans/plan-2026-03-13-doctor-command-implementation.md`
