---
title: "Character count mode initial implementation"
created-date: 2026-01-21
status: completed
agent: codex
---

## Summary

- Added `char` mode with alias normalization for CLI and API calls.
- Implemented grapheme-aware character counting with `Intl.Segmenter` fallback support.
- Extended breakdown types/results for character counts and updated CLI labels for clarity.
