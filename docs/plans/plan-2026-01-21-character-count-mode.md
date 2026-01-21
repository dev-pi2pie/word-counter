---
title: "Character count mode"
date: 2026-01-21
modified-date: 2026-01-21
status: draft
agent: codex
---

## Goal

Add a character-counting mode to the word counter with emoji-safe counting and a tolerant mode alias mapping.

## Context

Current modes (chunk/segments/collector) are word-focused and use `Intl.Segmenter` with word granularity. A new character mode should count user-perceived characters (grapheme clusters), so emoji and combined glyphs count as one.

## Proposed Decisions

- Canonical mode: `char`.
- Accepted aliases: `chars`, `character`, `characters` (map to `char` internally).
- Tolerant alias mapping for existing modes to reduce CLI friction:
  - `chunk` | `chunks`
  - `segments` | `segment` | `seg`
  - `collector` | `collect` | `colle`
- Use `Intl.Segmenter` with `{ granularity: "grapheme" }` for character counting, falling back to `Array.from(text)` only if `Intl.Segmenter` is unavailable.
- `char` mode returns counts only (no grapheme segments) to avoid expanding output options.
- `char` mode honors `collectNonWords` and includes non-words in the total like other modes.

## Implementation Plan

- [ ] Add `char` to `WordCounterMode` and update option parsing to normalize aliases (CLI + API).
- [ ] Introduce a grapheme segmenter helper (parallel to word segmenter) and a `countCharsForLocale` function.
- [ ] Extend the breakdown shape to support `char` mode counts only (no grapheme lists).
- [ ] Update CLI output labels to ensure mode + `--non-words` differences are clear.
- [ ] Update README/examples for the new mode, alias behavior, and emoji/grapheme counting explanation.
- [ ] Add unit tests for alias normalization and `char` counts, including emoji (single emoji, ZWJ sequences, variation selectors, flags) and `--non-words` behavior.

## Open Questions

None.

## Related Research

None.
