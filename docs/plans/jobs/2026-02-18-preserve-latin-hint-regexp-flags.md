---
title: "preserve latin hint regexp flags"
created-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Fix custom Latin hint `RegExp` handling so caller-provided flags are preserved.

## Summary

- Updated Latin hint pattern compilation to preserve incoming `RegExp` flags while still enforcing Unicode behavior.
- Reset `lastIndex` before each hint rule match to avoid stateful `g`/`y` flag side effects during repeated `.test()` calls.
- Added a regression test proving case-insensitive custom rules (for example `/[ä]/iu`) remain effective.

## Changes

- `src/wc/locale-detect.ts`
  - Preserve provided `RegExp.flags` and append `u` when missing.
  - Reset `hint.pattern.lastIndex` before testing each character.
- `test/word-counter.test.ts`
  - Added `preserves RegExp flags for custom Latin hint rules` regression coverage.

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts` (pass)
