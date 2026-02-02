---
title: "Implement whitespace non-words misc"
date: 2026-02-02
status: completed
agent: Codex
---

## Summary
- Implemented whitespace counting under `nonWords` with per-type breakdown and totals.
- Added CLI flags `--include-whitespace` and `--misc` (both imply `--non-words`).
- Emitted top-level `counts` when `nonWords` is enabled to expose words/non-words/total.
- Added unit tests for whitespace totals and `counts` visibility.
- Documented whitespace categories in `docs/schemas/whitespace-categories.md` and linked in README.
