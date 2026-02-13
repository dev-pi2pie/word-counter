---
title: "Adjust total labels for non-word counting"
created-date: 2026-01-16
status: completed
agent: codex
---

## Summary
- Updated CLI labels to distinguish word-only totals from combined word + non-word totals.
- Documented the labeling behavior for non-word collection in the README.

## Rationale
Non-word collection adds emoji, symbols, and punctuation into the total count. The CLI now reflects that combined total without changing raw output behavior.
