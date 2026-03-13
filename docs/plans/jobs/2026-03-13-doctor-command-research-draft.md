---
title: "doctor command research"
created-date: 2026-03-13
modified-date: 2026-03-13
status: completed
agent: Codex
---

## Goal

Draft and refine a research document for a future `doctor` command that verifies runtime capability, especially `Intl.Segmenter`, without expanding into WASM or broader feature work.

## What Changed

- Added `docs/researches/research-2026-03-13-doctor-command.md`.
- Captured:
  - why `Intl.Segmenter` should be treated as an essential doctor check
  - a scoped v1 command shape
  - proposed output and exit-code contracts
  - worker/jobs diagnostics reuse from existing code
- Refined the research document after review to keep JSON formatting aligned with the existing CLI contract:
  - `--format json` stays compact by default
  - `--format json --pretty` is the indented variant
- Expanded the worker-route diagnostics proposal to cover current preflight fallback paths:
  - env-based worker disable toggles
  - worker-pool module loadability
  - worker entry-file resolution
- Removed `cwd` from the proposed stable runtime payload so the JSON contract is internally consistent and less environment-specific.
- Added `src/cli/batch/jobs/worker-pool.ts` to the research references because the proposal depends on its availability checks.

## Validation

- Confirmed the proposal and later refinements align with current repo behavior and diagnostics hooks:
  - `README.md`
  - `src/cli/program/options.ts`
  - `src/wc/segmenter.ts`
  - `src/cli/batch/jobs/limits.ts`
  - `src/cli/batch/jobs/load-count-worker.ts`
  - `src/cli/batch/jobs/worker-pool.ts`
  - `src/command.ts`

## Related Research

- `docs/researches/research-2026-03-13-doctor-command.md`
