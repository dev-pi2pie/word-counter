---
title: "Refactor wc.ts and Improve Locale Detection"
created-date: 2026-01-02
modified-date: 2026-01-14
status: completed
agent: Codex
---

## Scope
- Split `src/wc/wc.ts` into smaller, purpose-focused modules for readability and testability.
- Document a regex-based language/script detection strategy and its limits (see research doc).

## Goals
- Reduce cognitive load in `wc.ts` by separating locale detection, segmentation, and aggregation.
- Keep Node.js runtime compatibility and existing behavior stable.
- Prepare for future locale detection improvements without changing public APIs.

## Proposed Structure
- `src/wc/locale-detect.ts` for script regexes and locale selection logic.
- `src/wc/segment.ts` for locale chunking and merge logic.
- `src/wc/segmenter.ts` for `Intl.Segmenter` cache utilities.
- `src/wc/analyze.ts` for chunk analysis and collector aggregation.
- `src/wc/wc.ts` as a thin orchestrator (public API).

## Implementation Steps
1. Extract regex and `detectLocaleForChar` into `locale-detect.ts`; export `DEFAULT_LOCALE` and helpers.
2. Move `segmentTextByLocale` and `mergeAdjacentChunks` into `segment.ts` and wire imports.
3. Move `segmenterCache`, `getSegmenter`, and word counting to `segmenter.ts`.
4. Move `analyzeChunk` and `aggregateByLocale` into `analyze.ts`.
5. Ensure `wc.ts` exports the same public types and functions as today.
6. Add/adjust tests for segmentation and word counting to guard refactor behavior.

## Risks / Notes
- Locale detection changes are out of scope for this refactor; keep outputs identical.
- Any script detection expansion should align with the research doc and include tests.

## Related Research
- `docs/researches/research-2026-01-02-language-detection.md`
- `docs/researches/research-2026-01-02-word-counter-options.md`

## References
- `docs/researches/research-2026-01-02-language-detection.md`
