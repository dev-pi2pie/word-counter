---
title: "Latin locale hints and edge-case segmentation"
created-date: 2026-01-16
status: completed
agent: Codex
---

## Summary
- Add optional Latin locale hints to locale detection and CLI.
- Improve mixed-script handling for leading neutral characters.
- Add tests for emoji, punctuation, apostrophes, and URLs.

## Rationale
- Intl.Segmenter is accurate for word boundaries, but locale selection for Latin text is ambiguous without hints.
- Leading neutral characters (emoji/punctuation) should follow the first detected script for clearer chunking.
- Edge-case tests guard behavior for common text patterns.
