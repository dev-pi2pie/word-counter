---
title: "Emoji + symbol segmentation add-on"
created-date: 2026-01-16
modified-date: 2026-02-15
status: completed
agent: Codex
---

## Goal
Explore an add-on that collects emoji and symbol segments alongside word counts, aligned with existing `--mode` output styles, while keeping `Intl.Segmenter` as the source of word boundaries.

## Key Findings
- Current API surface: `WordCounterOptions` supports `mode?: "chunk" | "segments" | "collector" | "char"` and language-tag hints (`latinLanguageHint`, `latinTagHint`, legacy `latinLocaleHint`, plus Han hints). The CLI mirrors this with `--mode` and the `--latin-*` / `--han-*` hint flags.
- `Intl.Segmenter` only marks wordlike segments via `isWordLike`. Emoji, punctuation, and most symbols are not wordlike and are therefore excluded from word counts by design.
- Mixed-script chunking already groups text by locale; emoji/symbols are currently neutral and ride along in the chunk text but do not appear in segment lists.

## Implications or Recommendations
- Keep word counts as-is (derived from `isWordLike`). Add an optional collection pipeline for non-word segments.
- Align the add-on with existing modes:
  - `chunk`: for each chunk, collect non-word segments with a per-chunk list/count (emoji + symbols) in the breakdown payload.
  - `segments`: include non-word segments in a parallel list to `segments`, or include a structured `nonWordSegments` array with categories.
  - `collector`: aggregate emoji/symbol counts (and/or segment lists) across the whole input, independent of locale or as a special locale bucket.
- Prefer a new option flag that is opt-in (e.g., `nonWords: boolean`). Keep defaults unchanged.
- Classification approach for the add-on:
  - Emoji detection: use Unicode property regex for emoji presentation (e.g., `\p{Emoji_Presentation}`) with `u` flag.
  - Symbols detection: use general category `\p{S}` to capture symbols. Exclude punctuation (`\p{P}`) unless explicitly requested.
  - For CLI/JSON output, return both counts and raw segment strings for traceability, similar to `segments` mode.

## Decisions (2026-01-16)
- Emoji, symbols, and punctuation should be separate categories.
- Add a new opt-in flag for non-word collection with concise labels.
- Default behavior remains word-only (based on `Intl.Segmenter` wordlike segments).
- Non-words are aggregated into a locale-neutral area in `collector` mode.
- Emoji classification takes precedence over symbol classification when overlapping.

## Open Questions
- None yet.

## References
- `src/wc/segmenter.ts` (wordlike segments based on `Intl.Segmenter`)
- `src/wc/segment.ts` (locale chunking)
- `src/wc/types.ts` (current options + modes)
- `src/command.ts` (CLI API surface)
