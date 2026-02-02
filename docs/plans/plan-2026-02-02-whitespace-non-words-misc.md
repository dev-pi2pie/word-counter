---
title: "Whitespace counting via non-words misc bucket"
date: 2026-02-02
status: active
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
- When `nonWords` is enabled, emit explicit totals for `words`, `nonWords`, and `total` in JSON details.
- When `includeWhitespace` is enabled, the `nonWords` total includes whitespace counts.

## Totals Rules

- `nonWords: true` (no whitespace):
  - `total = words + nonWords(emoji + symbols + punctuation)`
- `nonWords: true` + `includeWhitespace: true` (aka `--misc`):
  - `total = words + nonWords(emoji + symbols + punctuation + whitespace)`

## Output Shape (Draft)

- Extend existing `nonWords` structures with `whitespace` counts:
  - `whitespace: { spaces: number; tabs: number; newlines: number; other: number }`
- Add optional `counts` in JSON details when `nonWords` is enabled:
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
- [ ] Add option normalization to map `--misc` (CLI-only) to `nonWords + includeWhitespace`.
- [ ] Add `includeWhitespace` to the API options (no `misc` API option).
- [ ] Update total computation to reflect the rules above.

### Phase 2: Whitespace classification + aggregation
- [ ] Extend segmentation helpers to classify whitespace-like graphemes (spaces, tabs, newlines, other).
- [ ] Update non-words aggregation to include `whitespace` when enabled (only under `nonWords`).
- [ ] Add JSON details `counts` when `nonWords` is enabled (emit explicit totals: `words`, `nonWords`, `total`; include wherever non-words details are already emitted so consumers do not recompute).

### Phase 3: Tests
- [ ] Add unit tests for default totals (unchanged).
- [ ] Add unit tests for `--non-words` totals excluding whitespace.
- [ ] Add unit tests for `--misc` totals including whitespace (spaces, tabs, newlines).
- [ ] Add unit tests for JSON details: `counts` and `whitespace` appear only when enabled.

### Phase 4: Docs
- [ ] Update README CLI flags for `--include-whitespace` and `--misc`.
- [ ] Update API reference for `includeWhitespace` and `nonWords` totals behavior.
- [ ] Add an example output snippet showing `nonWords.whitespace` and `counts`.

## Decisions

- `misc?: boolean` is CLI-only (no API option).
- `whitespace` stays under `nonWords` (no separate top-level object).

## Related Research

- `docs/research-2026-01-21-whitespace-tab-counting.md`
- `docs/research-2026-01-16-emoji-symbol-segmentation.md`

## Related Plans

- `docs/plans/plan-2026-01-16-non-words-addon.md`
- `docs/plans/plan-2026-01-21-character-count-mode.md`
