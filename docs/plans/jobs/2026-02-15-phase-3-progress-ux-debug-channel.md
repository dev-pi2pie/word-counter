---
title: "Phase 3 progress UX and debug channel"
created-date: 2026-02-15
modified-date: 2026-02-15
status: completed
agent: Codex
---

## Summary

Implemented Phase 3 from `v0.1.0` canary plan:

- Added batch progress UX in standard output mode with transient TUI behavior.
- Added `--no-progress` opt-out.
- Kept single-input runs free of progress output by default.
- Preserved clean machine-readable output for `raw` and `json`.
- Extended `--debug` with structured lifecycle diagnostics on `stderr`.
- Refined progress formatting to use block-bar rendering with elapsed time and reduced debug/progress interference.
- Updated elapsed timing to include sub-second precision and start from full batch lifecycle (resolve/load/count).

## Key Changes

- Added `src/cli/progress/reporter.ts` for a dedicated transient progress renderer.
- Added `src/cli/debug/channel.ts` for structured debug events (`[debug]` JSON payloads).
- Added `src/cli/batch/run.ts` to orchestrate batch resolve/load/count lifecycle with hooks.
- Updated `src/cli/batch/aggregate.ts` to support progress callbacks while counting files.
- Updated progress rendering to match the research sketch format (`████...░░`, percentage, `completed/total`, `elapsed mm:ss`).
- Added non-TTY fallback line updates for progress visibility when carriage-return animation is unavailable.
- Added `--keep-progress` opt-in to keep final progress line visibility without requiring `--debug`.
- Updated `src/command.ts` to:
  - expose `--no-progress`
  - expose `--keep-progress`
  - wire progress and debug modules into batch execution
  - keep output contracts intact
- Added CLI tests for progress behavior, lifecycle diagnostics, and stream separation.

## Validation

- `bun test`
- `bun run type-check`

## Related Research

- `docs/research-2026-02-13-cli-progress-indicator.md`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
