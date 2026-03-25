---
title: "inspect path alias"
created-date: 2026-03-25
modified-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Add short aliases for inspect file and format input so the subcommand is easier to discover and use.

## What Changed

- Updated the hand-rolled inspect CLI parser to accept:
  - `-p` as an alias for `--path`
  - `-f` as an alias for `--format`
- Updated inspect help text to advertise the short aliases.
- Updated the README inspect examples to show the short aliases.
- Added CLI regression coverage proving:
  - `word-counter inspect -p <file>` works
  - `word-counter inspect -f json ...` works

## Validation

- `bun test test/command.test.ts --test-name-pattern "inspect command"`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
