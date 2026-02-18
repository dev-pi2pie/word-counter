---
title: "add punctuation/newline carry-break rules for latin and ja-und-hani"
created-date: 2026-02-18
modified-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Prevent locale carry from overextending across unrelated text, with explicit boundary handling for Latin carry and Japanese-to-Han carry.

## Summary

- Fixed retroactive relabeling of long `und-Latn` buffers when a specific Latin hint appears later.
- Added shared boundary-aware carry reset so non-default Latin locale carry and `ja -> Han` carry do not leak across delimiters.
- Expanded boundary coverage to include comma, colon, semicolon, newline, and sentence punctuation in ASCII/fullwidth/halfwidth variants.
- Preserved mid-token hint promotion behavior (for example `mañana`) and existing custom hint flows.

## Changes

- `src/wc/locale-detect.ts`
  - Added an `allowLatinLocaleCarry` parameter to `detectLocaleForChar`.
  - Gated non-default Latin locale carry (`previousLocale`) behind that flag.
  - Added `allowJapaneseHanCarry` parameter to gate `ja -> Han` carry.
- `src/wc/segment.ts`
  - Added shared hard-boundary tracking for carry reset and applied it to both Latin and `ja -> Han` carry.
  - Updated locale detection call to disable carry after boundaries.
  - Reworked `und-Latn` buffer promotion to split at the most recent promotion-break boundary, preserving hinted-word integrity (`el niño` stays whole as `niño`) while preventing unrelated prior text relabeling.
  - Final boundary set:
    - `HARD_BOUNDARY_REGEX`: `[\r\n,.!?;:，、。！？；：．｡､]`
    - `LATIN_PROMOTION_BREAK_REGEX`: `[\s,.!?;:，、。！？；：．｡､]`
- `test/word-counter.test.ts`
  - Added regression coverage ensuring prior text is not relabeled when a later Latin hint appears.
  - Added regression coverage ensuring hinted Latin words remain intact across whitespace boundaries (for example `el niño`).
  - Added regression coverage ensuring carried Latin locale resets after periods (`.`, `。`, `．`, `｡`) and comma/colon/semicolon variants.
  - Added regression coverage ensuring `ja -> Han` carry resets after periods, comma/colon/semicolon variants (including ideographic comma `、`), and newline.

## Validation

- `bun test test/word-counter.test.ts` (pass)
- `bun test test/command.test.ts` (pass)
