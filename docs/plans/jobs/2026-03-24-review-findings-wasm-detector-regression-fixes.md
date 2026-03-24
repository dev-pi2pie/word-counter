---
title: "Review findings wasm detector regression fixes"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Address the follow-up review findings in the WASM detector path without regressing existing CLI or library behavior.

## What Changed

- Updated `src/detector/wasm.ts` so accepted WASM Latin windows reapply rule-based Latin hint segmentation before fallback relabeling.
- Preserved detector-selected locales for the surrounding accepted Latin text while keeping built-in and custom hint-derived subspans such as Spanish or Polish chunks.
- Updated `src/detector/policy.ts` so the Latin quality gate evaluates contiguous non-technical prose blocks instead of requiring each physical line to meet the prose threshold on its own.
- Added regression coverage in `test/word-counter.test.ts` for:
  - hard-wrapped English prose that should still be accepted by the WASM detector
  - built-in Latin hint preservation inside accepted WASM windows
  - custom Latin hint preservation inside accepted WASM windows

## Why

- Deferring all Latin hinting before detector routing caused accepted WASM windows to swallow more specific Latin hint spans.
- The line-by-line quality gate introduced false negatives for normal hard-wrapped markdown prose.

## Verification

- Ran `bun test test/word-counter.test.ts`
- Ran `bun test test/command.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`
- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`
