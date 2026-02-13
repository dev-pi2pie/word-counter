---
title: "Locale Defaults and Latin Diacritic Hints"
created-date: 2026-01-02
modified-date: 2026-01-14
status: completed
agent: Codex
---

## Goal
Move locale defaults to language-only tags and add simple Latin diacritic hints.

## Changes
- Default Latin locale is now `en` (language-only).
- Region-specific tags removed where possible: `ja`, `ko`, `th`, etc.
- Added diacritic-based hints for `de`, `es`, `pt`, `fr`.
- Updated tests and README examples to match new defaults.

## Verification
- `bun test`

> [!NOTE]
> 2026-01-14: The default Latin locale was changed from `en` to `und-Latn` to avoid incorrect English attribution for ambiguous Latin text.
