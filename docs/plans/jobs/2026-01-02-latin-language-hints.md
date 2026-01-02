---
title: "Locale Defaults and Latin Diacritic Hints"
date: 2026-01-02
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
