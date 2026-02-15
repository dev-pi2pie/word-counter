---
title: "Fix empty Han hint fallback behavior"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Fix the Han hint resolution path so empty hint values do not crash segmentation and properly fall back to supported defaults or aliases.

## What Changed

- Updated `src/wc/locale-detect.ts` to treat empty/whitespace `hanTagHint` and `hanLanguageHint` values as missing.
- Added regression coverage in `test/word-counter.test.ts` for:
  - empty `hanTagHint` falling back to default Han tag
  - empty `hanTagHint` falling back to `hanLanguageHint`
- Added CLI regression coverage in `test/command.test.ts` for empty `--han-tag` with `--han-language` fallback.

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
