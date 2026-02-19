---
title: "latin custom hints v2 implementation"
created-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Implement the custom Latin hints v2 plan across API, locale detection, CLI flags, tests, and docs.

## Summary

- Added configurable Latin hint rules to the library API.
- Added CLI support for repeatable inline Latin hints, JSON file-based hints, and disabling built-in defaults.
- Kept fallback behavior backward compatible when no custom rules are provided.
- Added tests for rule parsing, precedence, fallback, and compatibility.
- Updated README usage and locale-detection documentation.

## Changes

- `src/wc/types.ts`
  - Added `LatinHintRule`.
  - Added `latinHintRules` and `useDefaultLatinHints` to `WordCounterOptions`.
- `src/wc/locale-detect.ts`
  - Added `DEFAULT_LATIN_HINT_RULES` constants.
  - Added rule compilation/validation with deterministic priority/order sorting.
  - Added resolved detection context for per-call reuse.
  - Added support for custom Latin rules and optional default-rule disable mode.
  - Preserved fallback chain: `latinTagHint` > `latinLanguageHint` > `latinLocaleHint` > `und-Latn`.
- `src/wc/segment.ts`
  - Pre-resolves locale-detection context once per segmentation call.
- `src/wc/wc.ts`, `src/wc/index.ts`
  - Wired new Latin hint options through `wordCounter` and exported `LatinHintRule`.
- `src/cli/program/options.ts`
  - Added `--latin-hint <tag>=<pattern>` (repeatable).
  - Added `--latin-hints-file <path>`.
  - Added `--no-default-latin-hints`.
- `src/cli/runtime/types.ts`, `src/cli/runtime/options.ts`
  - Added CLI runtime fields for new options.
  - Added inline hint parsing and JSON file parsing/validation.
  - Merged custom rules deterministically (CLI inline first, then file rules).
- `test/word-counter.test.ts`
  - Added API/segmentation tests for custom rules, priority tie-breaks, fallback behavior, no-default mode, and invalid pattern handling.
- `test/command.test.ts`
  - Added CLI tests for repeated `--latin-hint`, file + CLI merge ordering, no-default mode, and malformed inline hint format parsing.
- `README.md`
  - Added CLI/API examples and JSON file format for custom Latin hints.
  - Added locale-detection notes for custom hints and no-default behavior.

## Validation

- `bun test test/word-counter.test.ts` (pass)
- `bun test test/command.test.ts` (pass)
- `bun run type-check` (pass)
- `bun run build` (pass)

## Related Plans

- `docs/plans/plan-2026-02-18-latin-custom-hints-v2.md`

## Related Research

- `docs/researches/research-2026-02-18-latin-custom-hints-v2.md`
