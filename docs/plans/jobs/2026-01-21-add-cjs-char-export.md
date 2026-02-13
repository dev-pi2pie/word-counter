---
title: "Add CJS export for countCharsForLocale"
created-date: 2026-01-21
status: completed
agent: codex
---

## Summary
- added the CommonJS export for `countCharsForLocale` to keep CJS and ESM APIs aligned.

## Rationale
- reviewer noted the CJS entry point missed the new export, which made `require()` consumers unable to access it.
