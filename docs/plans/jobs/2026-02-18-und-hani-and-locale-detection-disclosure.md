---
title: "Switch Han fallback to und-Hani and document locale detection limits"
created-date: 2026-02-18
status: completed
agent: Codex
---

## Summary

- Switched the default Han fallback tag from `zh-Hani` to `und-Hani` so script-only detection does not over-claim Chinese.
- Updated user-facing docs to explicitly disclose the current locale detection approach and Latin diacritic heuristic scope.

## Why

- Regex script detection can identify Han script but cannot reliably infer language (`zh` vs `ja` vs mixed CJK) without stronger evidence.
- README needed clearer disclosure of current detection heuristics and limitations, especially for European Latin diacritics.

## Changes

- `src/wc/locale-detect.ts`
  - Changed `DEFAULT_HAN_TAG` from `zh-Hani` to `und-Hani`.
- `test/word-counter.test.ts`
  - Updated Han fallback expectations from `zh-Hani` to `und-Hani`.
- `test/command.test.ts`
  - Updated batch char-collector expectation from `zh-Hani` to `und-Hani`.
- `README.md`
  - Updated examples and notes from `zh-Hani` to `und-Hani`.
  - Added explicit detection disclosure:
    - regex/script-based routing
    - current built-in Latin diacritic buckets (`de`, `es`, `pt`, `fr`)
    - limitations for other European diacritics
- `docs/research-2026-01-02-language-detection.md`
  - Updated implementation notes to `und-Hani`.
  - Clarified `und-*` script tagging rationale.
- `docs/breaking-changes-notes.md`
  - Updated language-tag note to `und-Hani`.

## Verification

- Ran unit tests covering core locale segmentation behavior and CLI aggregation:
  - `bun test test/word-counter.test.ts test/command.test.ts`

## Related Research

- `docs/research-2026-01-02-language-detection.md`
