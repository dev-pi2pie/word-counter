---
title: "preserve latin hint regexp flags"
created-date: 2026-02-18
modified-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Fix custom Latin hint `RegExp` handling so caller-provided flags are preserved.

## Summary

- Updated Latin hint pattern compilation to preserve incoming `RegExp` flags while still enforcing Unicode behavior.
- Updated Unicode enforcement to respect `v`-flag patterns (do not append `u` when `v` is already present).
- Reset `lastIndex` before each hint rule match to avoid stateful `g`/`y` flag side effects during repeated `.test()` calls.
- Added a regression test proving case-insensitive custom rules (for example `/[ä]/iu`) remain effective.
- Added runtime-safe regression coverage for Unicode-set `v` flag patterns.

## Changes

- `src/wc/locale-detect.ts`
  - Preserve provided `RegExp.flags`; append `u` only when neither `u` nor `v` is present.
  - Reset `hint.pattern.lastIndex` before testing each character.
- `test/word-counter.test.ts`
  - Added `preserves RegExp flags for custom Latin hint rules` regression coverage.
  - Added `accepts Unicode-set v flag RegExp rules when runtime supports them` regression coverage.

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts` (pass)
