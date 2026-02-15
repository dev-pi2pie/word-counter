---
title: "Add Simplified Chinese Han hint tests"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Extend Han hint test coverage to include Simplified Chinese inputs in addition to Traditional Chinese.

## What Changed

- Added a `segmentTextByLocale` regression test in `test/word-counter.test.ts` for:
  - Simplified Chinese text `汉字测试`
  - `hanTagHint: "zh-Hans"`
- Added a CLI compatibility test in `test/command.test.ts` for:
  - `--han-tag zh-Hans`
  - Simplified Chinese input `汉字测试`

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
