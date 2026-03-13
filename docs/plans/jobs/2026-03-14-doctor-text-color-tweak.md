---
title: "doctor text color tweak"
created-date: 2026-03-14
status: completed
agent: Codex
---

## Goal

Adjust `doctor` text-mode output so boolean-style values are easier to scan and numeric diagnostics stand out more clearly.

## What Changed

- Updated `src/cli/doctor/render.ts` text-mode formatting:
  - keys keep their existing styling
  - bool-like values now render green for positive states and red for negative states
  - numeric values now render yellow
- Kept JSON output unchanged.

## Validation

- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-03-13-doctor-command-implementation.md`
