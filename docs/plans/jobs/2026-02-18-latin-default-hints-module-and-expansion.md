---
title: "latin default hints module and expansion"
created-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Move default Latin hint constants into a dedicated module and expand built-in default hints.

## Summary

- Moved `DEFAULT_LATIN_HINT_RULES` from locale detection internals into `src/wc/latin-hints.ts`.
- Expanded built-in defaults from 4 to 9 language buckets.
- Updated tests and README to reflect expanded default behavior.

## Changes

- `src/wc/latin-hints.ts`
  - Added new source-of-truth module for default Latin hint rules.
  - Added new built-in buckets: `pl`, `tr`, `ro`, `hu`, `is`.
- `src/wc/locale-detect.ts`
  - Imports defaults from `src/wc/latin-hints.ts`.
- `src/wc/wc.ts`, `src/wc/index.ts`
  - Re-exported `DEFAULT_LATIN_HINT_RULES` from public wc entry.
- `test/word-counter.test.ts`
  - Expanded default diacritic detection coverage for new built-in buckets.
- `README.md`
  - Updated built-in Latin heuristic list.

## Validation

- `bun test test/word-counter.test.ts` (pass)
- `bun test test/command.test.ts` (pass)
- `bun run type-check` (pass)

## Related Plans

- `docs/plans/plan-2026-02-18-latin-custom-hints-v2.md`

## Related Research

- `docs/research-2026-02-18-latin-custom-hints-v2.md`
