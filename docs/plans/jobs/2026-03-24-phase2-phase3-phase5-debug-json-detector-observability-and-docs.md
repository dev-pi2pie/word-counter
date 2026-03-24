---
title: "Phase 2 phase 3 phase 5 debug json detector observability and docs"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Finish the remaining phases of the debug observability and WASM Latin quality plan by landing single-input debug parity, detector observability, and the schema/README closure work.

## What Changed

- Extended single-input execution in `src/cli/runtime/single.ts`.
  - added `runtime.single.start` and `runtime.single.complete` debug events
  - added debug-gated single-input JSON detector summaries under `debug.detector`
- Normalized debug-gated JSON output in `src/cli/runtime/batch.ts`.
  - added top-level `debug.skipped`
  - retained top-level `skipped` for per-file compatibility
  - added aggregated `debug.detector` summaries
  - added per-entry `files[i].debug.detector` summaries
- Added detector observability plumbing in `src/detector/debug.ts` and `src/detector/wasm.ts`.
  - compact detector summary events
  - verbose per-window detector events
  - detector summary aggregation for JSON output
- Extended batch execution routes to preserve detector observability across both async and worker execution.
  - updated `src/cli/batch/jobs/load-count.ts`
  - updated worker protocol and worker-pool forwarding
  - updated `src/cli/batch/jobs/worker/count-worker.ts`
- Added and updated documentation:
  - `docs/schemas/debug-event-stream-contract.md`
  - `docs/schemas/json-output-contract.md`
  - `README.md`

## Why

- Single-input runs needed to use the same debug model as batch execution.
- Detector investigation needed structured observability that survives both direct and worker-backed execution paths.
- The JSON and debug-report contracts needed final schema and user-facing documentation before the plan could be considered complete.

## Verification

- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`

## Related Jobs

- `docs/plans/jobs/2026-03-24-phase1-phase4-debug-envelope-and-latin-guardrails.md`

## Related Research

- `docs/researches/research-2026-03-24-global-debug-observability-model.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
