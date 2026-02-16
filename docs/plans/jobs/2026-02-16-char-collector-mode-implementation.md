---
title: "Implement char-collector mode with alias matrix and compatibility coverage"
created-date: 2026-02-16
status: completed
agent: Codex
---

## Summary

- Added new canonical mode `char-collector` while preserving existing `char` behavior.
- Implemented deterministic composed alias normalization for char-family + collector-family forms, including:
  - `char-collector`
  - `charcollector`
  - `char-collect`
  - `collector-char`
  - `characters-collector`
  - `colchar`
  - `charcol`
  - `char-col`
  - `char-colle`
- Added collector-style per-locale character aggregation with grapheme-aware counting semantics.
- Added batch merge support for `char-collector`.
- Updated CLI/base-output normalization paths to keep `--total-of` compatibility behavior consistent with existing contracts.
- Updated README mode/type/alias documentation and examples.

## Verification

- Ran `bun test` successfully (`110 pass`, `0 fail`).

## Related Plans

- `docs/plans/plan-2026-02-16-char-collector-mode.md`
- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
