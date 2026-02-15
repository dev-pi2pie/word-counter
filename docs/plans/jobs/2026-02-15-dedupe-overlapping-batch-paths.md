---
title: "Deduplicate overlapping batch path inputs"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Address duplicate counting when users pass overlapping `--path` inputs (for example a directory and a file inside it).

## What Changed

- Updated `resolveBatchFilePaths` to deduplicate resolved absolute file paths before returning.
- Preserved deterministic output ordering by sorting after deduplication.
- Added regression coverage for path resolution overlap handling.
- Added CLI-level regression coverage to verify aggregate totals are not inflated by overlapping inputs.

## Validation

- `bun test test/command.test.ts`
- `bun test`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-15-command-modularization-and-extension-filters.md`
