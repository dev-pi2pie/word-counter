---
title: "Defer latin locale hint"
date: 2026-01-16
status: completed
agent: codex
---

## Summary
- Adjusted Latin locale detection so the optional `latinLocaleHint` applies only when no prior Latin locale is established, preserving more specific signals.

## Rationale
- Avoids hint overrides after diacritic-based locale detection, keeping locale segments stable for mixed Latin text.
