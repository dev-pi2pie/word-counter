---
title: "Phase 6 debug verbosity and report-file follow-up"
created-date: 2026-02-16
status: completed
agent: Codex
---

## Scope

Implement the Phase 6 follow-up work for debug diagnostics usability:

- debug verbosity modes (`compact` default, `verbose` opt-in)
- debug report-file routing (`--debug-report`, `--debug-report-tee`)
- deterministic report naming + collision behavior
- regression coverage and docs sync

## What Changed

- Added new CLI options in `src/command.ts`:
  - `--verbose`
  - `--debug-report [path]`
  - `--debug-report-tee`
- Extended debug channel in `src/cli/debug/channel.ts`:
  - verbosity-aware event filtering
  - output sink abstraction (terminal + file)
  - file-first routing with optional tee
  - deterministic default report naming (`wc-debug-YYYYMMDD-HHmmss-<pid>.jsonl`)
  - collision-safe suffixing (`-<n>`)
- Reclassified path-resolution diagnostics in `src/cli/path/resolve.ts`:
  - compact summary events for dedupe/filter
  - per-file dedupe/filter events moved to verbose mode
- Added regression tests in `test/command.test.ts` for:
  - compact vs verbose event volume
  - file-only debug routing
  - tee routing
  - default report naming
  - collision suffix behavior
- Updated user/developer docs:
  - `README.md`
  - `docs/schemas/default-config.md`
  - updated related plan checklists and plan status.

## Validation

- `bun test test/command.test.ts`
- `bun test`
- `bun run build`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
- `docs/plans/plan-2026-02-16-debug-verbosity-and-report-file.md`
