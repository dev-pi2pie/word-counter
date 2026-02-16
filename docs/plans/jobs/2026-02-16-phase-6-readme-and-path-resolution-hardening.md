---
title: "Phase 6 README and path-resolution hardening"
created-date: 2026-02-16
status: completed
agent: Codex
---

## Scope

Complete the remaining Phase 6 canary hardening tasks for README flow, mixed-input path-resolution contract (`#26`), and path-debug diagnostics.

## What Changed

- Reorganized `README.md` so `npx @dev-pi2pie/word-counter` is the first quick-start path.
- Added an explicit install/usage decision flow for:
  - one-off `npx`
  - global CLI install
  - library usage in code
- Refreshed CLI examples for:
  - batch counting
  - progress flags (`--no-progress`, `--keep-progress`)
  - selective totals (`--total-of`)
- Added and documented a stable mixed-input resolution contract for repeated `--path`:
  - file + directory mixed roots
  - deterministic absolute-path ordering
  - absolute-path dedupe across overlaps
  - extension-filter behavior split between directory scans and direct-file inputs
- Extended path resolution internals with debug diagnostics (`stderr` only) for:
  - root expansion
  - extension-filter exclusions
  - dedupe accept/duplicate decisions
- Added regression coverage in `test/command.test.ts` for:
  - mixed-input deterministic ordering
  - overlap dedupe across nested roots
  - filter semantics in mixed scan + direct-path runs
  - debug event coverage for path-resolution decisions
- Synced `docs/schemas/default-config.md` with the same `#26` contract semantics and updated `modified-date`.
- Marked all remaining Phase 6 checklist items complete in the phased delivery plan.

## Validation

- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`
- `bun test`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
