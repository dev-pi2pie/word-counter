---
title: "Example huge logs generator/cleaner script"
created-date: 2026-02-15
modified-date: 2026-02-15
status: completed
agent: Codex
---

## Summary

Added utility scripts for the new example folder `examples/test-case-huge-logs` so large synthetic inputs can be created and reset quickly, with randomizable word counts.

## Changes

- Added `/Users/nakolus/Projects/github-work/dev-pi2pie/word-counter/examples/manage-huge-logs.mjs` as the main implementation (runnable by `node` or `bun`).
- Added `/Users/nakolus/Projects/github-work/dev-pi2pie/word-counter/examples/manage-huge-logs.sh` as a thin wrapper that calls the JS script.
- Implemented commands:
  - `create <file-count> [words-per-file]`
  - `clean`
  - `reset <file-count> [words-per-file]`
- `create/reset` words argument supports:
  - fixed count: `300`
  - default random: omit arg or use `random` (`120-480`)
  - random range: `200-700`
- Scripts generate `.txt` files with random word content and preserve `.gitignore`.
- Made scripts executable.

## Validation

- `./examples/manage-huge-logs.sh clean`
- `./examples/manage-huge-logs.sh create 3`
- `./examples/manage-huge-logs.sh create 3 random`
- `./examples/manage-huge-logs.sh create 3 10-20`
- `./examples/manage-huge-logs.sh clean`
