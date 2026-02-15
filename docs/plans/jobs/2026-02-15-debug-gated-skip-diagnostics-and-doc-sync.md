---
title: "Debug-gated skip diagnostics and docs sync"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Complete the remaining Phase 1 task in `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md` by gating skipped-file diagnostics behind `--debug`, then sync usage and schema docs.

## What Changed

- Added `--debug` CLI flag to `src/command.ts`.
- Updated batch behavior so skipped-file diagnostics are only emitted when:
  - `--debug` is enabled, and
  - `--quiet-skips` is not set.
- Updated per-file JSON output behavior:
  - omit `skipped` details without `--debug`
  - include `skipped` details when `--debug` is enabled.
- Updated README batch usage with current multi-path/directory/filter/debug examples.
- Updated default config draft to match debug-gated skip diagnostics behavior.
- Marked the Phase 1 debug-gating task complete in the phased delivery plan.

## Validation

- `bun run type-check`
- `bun test`
- `bun run build`
- CLI smoke checks with and without `--debug` for skipped-file diagnostics

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
- `docs/plans/plan-2026-02-15-command-modularization-and-extension-filters.md`
