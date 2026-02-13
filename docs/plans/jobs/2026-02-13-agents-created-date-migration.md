---
title: "Migrate docs frontmatter date key to created-date"
created-date: 2026-02-13
status: completed
agent: Codex
---

## Summary

Updated documentation frontmatter in `docs/` to replace `date` with `created-date` in line with the current AGENTS guide.

## Why

The repository standard now requires `created-date` for initial document dates and reserves `modified-date` for subsequent edits.

## Scope

- Replaced frontmatter key `date:` with `created-date:` across existing docs.
- Kept existing `status` values unchanged.
