---
title: "debug verbosity and report-file output"
created-date: 2026-02-16
modified-date: 2026-02-16
status: completed
agent: Codex
---

## Goal

Reduce debug-noise fatigue in batch runs by adding explicit debug verbosity levels and a report-file output path that can capture detailed diagnostics without flooding terminal output.

## Scope

- In scope:
  - Add two debug verbosity levels:
    - `compact`: high-signal lifecycle + summary decisions
    - `verbose`: full per-path/per-file decision events
  - Add debug report output option for writing diagnostics to a file.
  - Define file-routing behavior when report output is enabled.
  - Define deterministic report-file naming and default location behavior.
  - Add tests and docs for new debug controls.
- Out of scope:
  - Non-debug logging redesign.
  - Changes to counting/output result schema.

## Proposed UX

### Flags

- `--debug` keeps current role as debug gate.
- Add `--verbose` as the user-facing switch for verbose debug details.
  - default with `--debug`: `compact`
  - with `--debug --verbose`: `verbose`
  - implementation may still map these to internal debug levels
- Add `--debug-report [path]`:
  - no path: write to default report file in current working directory (`pwd`)
  - path provided: write to explicit path
- Add `--debug-report-tee`:
  - mirror debug diagnostics to both report file and terminal
  - valid only when `--debug-report` is enabled
  - short alias: `--debug-tee`

### Routing Rules

- Without `--debug-report`: diagnostics go to `stderr` as today.
- With `--debug-report`:
  - diagnostics default to file only
  - terminal debug output is suppressed by default
  - with `--debug-report-tee`, diagnostics go to both file and `stderr`
  - regular CLI output contract remains unchanged (`stdout`/progress behavior unaffected)

### Event Volume Rules

- `compact` should include:
  - phase start/complete and stage timings
  - input summary, resolved/skipped counts
  - dedupe summary counts (accepted/duplicates), not every per-file accept line
  - filter summary counts
- `verbose` should include all current detail-level events, including per-path dedupe/filter events.

## Debug Report Naming Contract (Draft)

- Default directory: current working directory (`pwd`).
- Default filename pattern:
  - `wc-debug-YYYYMMDD-HHmmss-<pid>.jsonl`
- Collision handling:
  - append `-<n>` increment suffix when needed.
- Format:
  - newline-delimited JSON (`.jsonl`) with streaming writes during execution.

## Implementation Outline

1. Extend debug channel to support verbosity filtering and output sink abstraction.
2. Add file sink writer and safe path creation behavior.
3. Reclassify existing debug events by verbosity level.
4. Add compact aggregation events for dedupe/filter summaries.
5. Add tests for:
   - compact (`--debug`) vs verbose (`--debug --verbose`) event selection
   - `stderr` routing vs file routing
   - `--debug-report-tee` dual-output routing
   - default naming/path contract and collision behavior
6. Update CLI docs (`README.md`) and option help text.

## Acceptance

- `--debug` defaults to compact output (substantially fewer per-file lines).
- `--debug --verbose` preserves detailed event visibility.
- `--debug --debug-report` writes diagnostics to file and does not print debug lines to terminal by default.
- `--debug --debug-report --debug-report-tee` writes diagnostics to file and terminal.
- Debug report path and naming behavior are deterministic and documented.
- No central log storage or retention/pruning behavior is introduced in this phase.
- Existing `stdout` contracts remain unchanged across `standard`, `raw`, and `json`.

## Completion Notes

- Implemented `--verbose` debug level selection (`compact` default, `verbose` opt-in).
- Implemented `--debug-report [path]` with file-first routing and `--debug-report-tee` mirror mode.
- Added `--debug-tee` as an alias of `--debug-report-tee`.
- Implemented deterministic default debug report naming:
  - `wc-debug-YYYYMMDD-HHmmss-<pid>.jsonl`
  - collision-safe `-<n>` suffix appending.
- Added compact summary debug events for path resolution:
  - dedupe summary (`accepted`, `duplicates`)
  - filter summary (`included`, `excluded`)
- Added regression coverage for:
  - compact vs verbose event selection
  - stderr-only vs file-only routing
  - tee routing
  - default report naming + collision suffix behavior
- Updated README and default-config draft docs for the new debug controls.

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
