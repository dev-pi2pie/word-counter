---
title: "char-collector mode for locale-aggregated character counting"
created-date: 2026-02-16
modified-date: 2026-02-16
status: completed
agent: Codex
---

## Goal

Add a new `char-collector` mode that keeps grapheme-aware character counting while aggregating per-locale totals in collector style.

## Context

Current `char` mode intentionally follows chunk-style breakdown order for backward compatibility. For locale-level reporting, users need a collector-style variant that collapses repeated locale chunks into one aggregated item while preserving the same character total semantics.

Issue linkage:

- Feature issue: `#33`
- Parent issue: `#21`

## Proposed Decisions

- Keep `char` behavior unchanged.
- Add `char-collector` as a new canonical `WordCounterMode`.
- Use deterministic alias normalization (no edit-distance fuzzy search).
- Preserve existing standalone aliases:
  - `collector`, `collect`, `colle` -> `collector`
  - `char`, `chars`, `character`, `characters` -> `char`
- Add composed alias forms for `char-collector`:
  - `char-collector` (canonical)
  - `charcollector`
  - `char-collect`
  - `collector-char`
  - `characters-collector`
  - `colchar`
  - `charcol`
  - `char-col`
  - `char-colle`

## Implementation Plan

- [x] Extend mode typing and CLI mode choices to include `char-collector`.
- [x] Update mode normalization to support deterministic composed alias handling for char-family + collector-family tokens.
- [x] Implement locale aggregation for character analyses and return a `char-collector` breakdown shape.
- [x] Keep total and non-word accounting parity with existing `char` mode semantics.
- [x] Ensure batch merge logic supports `char-collector` without mode mismatch.
- [x] Update standard/json/raw output paths for `char-collector` labels and rendering.
- [x] Add tests for alias parsing matrix and precedence (standalone vs composed aliases).
- [x] Add tests for single-input, section, and batch behavior parity in `char-collector`.
- [x] Update README mode table, alias list, and examples.
- [x] Add a completion job record under `docs/plans/jobs/` after implementation lands.

## Compatibility Gates

- [x] `--mode char` output and behavior remain unchanged.
- [x] Existing `collector`/`char` aliases keep current mapping.
- [x] `--total-of` behavior remains contract-compatible in standard/raw/json outputs.

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
- `docs/plans/plan-2026-01-21-character-count-mode.md`

## Related Research

- `docs/research-2026-02-13-batch-file-counting.md`
