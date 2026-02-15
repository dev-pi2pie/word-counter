---
title: "Language-tag hints and Han fallback alignment"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Summary

- Switched Han-script default fallback from `zh-Hans` to `zh-Hani`.
- Added CLI hint flags:
  - `--latin-language`
  - `--latin-tag`
  - `--han-language`
  - `--han-tag`
- Kept `--latin-locale` as a legacy compatibility alias.

## Why

- Regex/script checks can detect Han script but cannot reliably infer Simplified (`zh-Hans`) vs Traditional (`zh-Hant`).
- Script-level fallback (`zh-Hani`) is safer than forcing a specific variant.
- Language-tag naming better matches actual behavior and clarifies hint intent.

## Implementation Notes

- `src/wc/locale-detect.ts`
  - Added `DEFAULT_HAN_TAG = "zh-Hani"`.
  - Added Latin/Han hint resolution with clear precedence.
  - Han detection now returns hint override when provided, else `zh-Hani`.
- `src/command.ts`
  - Added new CLI flags and passed corresponding hints to `wordCounter` options.
- `src/wc/types.ts` and `src/wc/wc.ts`
  - Added and wired new hint option fields.

## Tests

- Updated existing Han fallback assertion to `zh-Hani`.
- Added tests for:
  - Latin hint precedence (`--latin-tag` > `--latin-language` > `--latin-locale`)
  - Han hint overrides (`--han-tag`, `--han-language`)

## Docs

- Updated README wording/examples for language-tag hints and Han fallback behavior.
- Added `docs/breaking-changes-notes.md` to track planned deprecations and migration notes.
- Updated canary phased plan to place this scope in `v0.1.0-canary.1` and shift later canaries by `+1`.
