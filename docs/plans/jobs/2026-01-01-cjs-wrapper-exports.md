---
title: "CJS wrapper exports for mixed default/named entry"
date: 2026-01-01
status: completed
agent: Codex
---

## Summary

- Add a CJS wrapper entry so `require("word-counter")` returns the default export
  while exposing named exports as properties.
- Wire the CJS build and package exports to use the wrapper entry.
- Document CJS usage and interop notes.

## Rationale

Tsdown warns about mixed default + named exports in the CJS bundle. A wrapper
entry can provide cleaner CJS ergonomics while keeping ESM exports intact.

## Changes

- Added `src/index.cjs.ts` as the CJS wrapper entry.
- Pointed the CJS build to the wrapper entry in `tsdown.config.ts`.
- Documented ESM and CJS usage in `README.md`.
