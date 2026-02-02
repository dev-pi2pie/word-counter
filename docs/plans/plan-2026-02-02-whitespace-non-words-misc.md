---
title: "Whitespace counting via non-words misc bucket"
date: 2026-02-02
status: completed
agent: Codex
---

## Goal

Add an opt-in whitespace-like counting path that extends the existing non-words feature, with a `--misc` convenience flag and clear totals for words vs non-words.

## Context

- Current totals include words only unless `--non-words` is enabled.
- `--non-words` adds emoji, symbols, and punctuation to totals, but ignores whitespace.
- Research suggests an extended non-words bucket is the least disruptive path for whitespace/tab counting.

## Proposed Decisions

- Add `--misc` as a convenience flag for `--non-words --include-whitespace`.
- Introduce `includeWhitespace: true` in the API to extend non-words with whitespace (tabs/newlines included).
- When `nonWords` is enabled, emit explicit totals for `words`, `nonWords`, and `total` at the top level in JSON details.
- When `includeWhitespace` is enabled, the `nonWords` total includes whitespace counts.
- `includeWhitespace` only affects modes that already emit non-words data.

## Totals Rules

- `nonWords: true` (no whitespace):
  - `total = words + nonWords(emoji + symbols + punctuation)`
- `nonWords: true` + `includeWhitespace: true` (aka `--misc`):
  - `total = words + nonWords(emoji + symbols + punctuation + whitespace)`

Note: In the CLI, `--include-whitespace` implies with `--non-words` (same behavior as `--misc`).
Note: `--non-words` alone does not include whitespace; use `--include-whitespace` or `--misc` for the combined total.

## Output Shape (Draft)

- Extend existing `nonWords` structures with `whitespace` counts:
  - `whitespace: { spaces: number; tabs: number; newlines: number; other: number }`
- Add optional top-level `counts` in JSON details when `nonWords` is enabled:
  - `counts: { words: number; nonWords: number; total: number }`
- Preserve the current payload shapes for each mode; only add fields when the flags are enabled.

## Scope

- CLI flags: `--include-whitespace` and `--misc`.
- API: `includeWhitespace?: boolean` and `misc?: boolean` (alias to set `nonWords` + `includeWhitespace`).
- Extend non-word aggregation logic to count whitespace using grapheme segmentation.
- Update totals aggregation and JSON details to include `counts` when `nonWords` is enabled.
- Update README and examples to describe `--misc` and totals behavior.
- Tests for whitespace counts, totals rules, and backward-compatible defaults.

## Implementation Plan

### Phase 1: Options + totals wiring
- [x] Add option normalization to map `--misc` (CLI-only) to `nonWords + includeWhitespace`.
- [x] Add `includeWhitespace` to the API options (no `misc` API option).
- [x] Update total computation to reflect the rules above.

### Phase 2: Whitespace classification + aggregation
- [x] Extend segmentation helpers to classify whitespace-like graphemes (spaces, tabs, newlines, other).
- [x] Update non-words aggregation to include `whitespace` when enabled (only under `nonWords`).
- [x] Add JSON details `counts` when `nonWords` is enabled (emit explicit totals: `words`, `nonWords`, `total`; include wherever non-words details are already emitted so consumers do not recompute).

### Phase 3: Tests
- [x] Add unit tests for default totals (unchanged).
- [x] Add unit tests for `--non-words` totals excluding whitespace.
- [x] Add unit tests for `includeWhitespace` totals including whitespace (spaces, tabs, newlines).
- [x] Add unit tests for JSON details: `counts` and `whitespace` appear only when enabled.

### Phase 4: Docs
- [x] Update README CLI flags for `--include-whitespace` and `--misc`.
- [x] Update API reference for `includeWhitespace` and `nonWords` totals behavior.
- [x] Add an example output snippet showing `nonWords.whitespace` and `counts`.

## Decisions

- `misc?: boolean` is CLI-only (no API option).
- In the CLI, `--include-whitespace` implies `--non-words` (same behavior as `--misc`).
- `whitespace` stays under `nonWords` (no separate top-level object).

## Related Research

- `docs/research-2026-01-21-whitespace-tab-counting.md`
- `docs/research-2026-01-16-emoji-symbol-segmentation.md`

## Related Plans

- `docs/plans/plan-2026-01-16-non-words-addon.md`
- `docs/plans/plan-2026-01-21-character-count-mode.md`
