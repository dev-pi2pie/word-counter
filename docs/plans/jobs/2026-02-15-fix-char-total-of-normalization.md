---
title: "Fix char mode base normalization for total-of fallback"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Fix inconsistent char-mode output when `--total-of` auto-enables non-word collection without explicit `--non-words`.

## What Changed

- Updated `normalizeWordCounterResultBase` in `src/command.ts`:
  - for `char` mode, subtract non-word grapheme counts from each breakdown item before removing `nonWords`.
  - preserves consistency between top-level `total` and per-locale char breakdown after base-output normalization.
- Added regression tests in `test/command.test.ts`:
  - standard output consistency test for `--mode char --total-of punctuation`.
  - JSON output consistency test for the same flag path.

## Validation

- `bun test test/command.test.ts`
- `bun test`
