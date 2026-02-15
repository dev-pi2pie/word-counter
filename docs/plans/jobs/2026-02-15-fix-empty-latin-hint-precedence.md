---
title: "Fix empty Latin hint precedence behavior"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Fix Latin hint precedence so empty tag inputs do not override valid lower-priority hints.

## What Changed

- Updated `src/wc/locale-detect.ts` to treat empty/whitespace Latin hints as missing while preserving precedence:
  - `latinTagHint`
  - `latinLanguageHint`
  - `latinLocaleHint`
- Added regression coverage in `test/word-counter.test.ts` for empty `latinTagHint` falling back to `latinLanguageHint`.
- Added CLI regression coverage in `test/command.test.ts` for empty `--latin-tag` falling back to `--latin-language`.

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
