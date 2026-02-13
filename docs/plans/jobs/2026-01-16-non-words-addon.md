---
title: "Implement --non-words add-on"
created-date: 2026-01-16
status: completed
agent: Codex
---

## Summary
- Add opt-in non-word collection (emoji, symbol, punctuation) to CLI and API.
- Extend breakdown payloads to include non-word collections by mode.
- Add tests to validate new output while preserving default behavior.

## Rationale
- Intl.Segmenter wordlike segments exclude emoji/symbols/punctuation by design.
- Users want optional visibility into non-word segments without changing defaults.
