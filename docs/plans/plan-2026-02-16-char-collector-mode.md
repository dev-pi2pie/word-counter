---
title: "char-collector mode for locale-aggregated character counting"
created-date: 2026-02-16
status: draft
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

- [ ] Extend mode typing and CLI mode choices to include `char-collector`.
- [ ] Update mode normalization to support deterministic composed alias handling for char-family + collector-family tokens.
- [ ] Implement locale aggregation for character analyses and return a `char-collector` breakdown shape.
- [ ] Keep total and non-word accounting parity with existing `char` mode semantics.
- [ ] Ensure batch merge logic supports `char-collector` without mode mismatch.
- [ ] Update standard/json/raw output paths for `char-collector` labels and rendering.
- [ ] Add tests for alias parsing matrix and precedence (standalone vs composed aliases).
- [ ] Add tests for single-input, section, and batch behavior parity in `char-collector`.
- [ ] Update README mode table, alias list, and examples.
- [ ] Add a completion job record under `docs/plans/jobs/` after implementation lands.

## Compatibility Gates

- [ ] `--mode char` output and behavior remain unchanged.
- [ ] Existing `collector`/`char` aliases keep current mapping.
- [ ] `--total-of` behavior remains contract-compatible in standard/raw/json outputs.

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
- `docs/plans/plan-2026-01-21-character-count-mode.md`
