---
title: "Add --debug-tee alias"
created-date: 2026-02-16
status: completed
agent: Codex
---

## Scope

Add a shorter, explicit alias for debug report tee mode while preserving current behavior and compatibility.

## What Changed

- Added CLI alias `--debug-tee` as an alias of `--debug-report-tee` in `src/command.ts`.
- Kept `--debug-report-tee` as the canonical flag and routed both to the same tee behavior.
- Updated dependency error messaging to mention both flag names.
- Added regression test coverage in `test/command.test.ts` for alias behavior.
- Updated docs in:
  - `README.md`
  - `docs/schemas/default-config.md`
  - related phase plan/sub-plan notes.

## Validation

- `bun test test/command.test.ts`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
- `docs/plans/plan-2026-02-16-debug-verbosity-and-report-file.md`
