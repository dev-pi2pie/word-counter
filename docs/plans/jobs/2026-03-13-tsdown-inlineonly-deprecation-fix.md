---
title: "tsdown inlineonly deprecation fix"
created-date: 2026-03-13
modified-date: 2026-03-13
status: completed
agent: Codex
---

## Goal

Remove the current `tsdown` build deprecation warning for `inlineOnly` and keep the CLI bundle behavior unchanged.

## What Changed

- Updated `tsdown.config.ts` to replace deprecated `inlineOnly` with `deps.onlyBundle` for the CLI bundle entry.

## Validation

- `bun run build` passed.
- Confirmed the previous warning no longer appears:
  - ``WARN  `inlineOnly` is deprecated. Use `deps.onlyBundle` instead.``
