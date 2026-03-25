---
title: "inspect json pretty output"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Add `--pretty` support to `word-counter inspect --format json` so inspect JSON output matches the existing counting CLI behavior.

## What Changed

- Extended the inspect-local parser to accept `--pretty`.
- Applied JSON indentation for both:
  - single-input inspect JSON output
  - batch inspect JSON output
- Updated inspect help text to advertise `--pretty`.
- Added command coverage for:
  - single-input pretty JSON output
  - batch pretty JSON output
- Updated inspect-facing docs to mention that `--pretty` changes JSON indentation only.

## Validation

- `bun test test/command.test.ts --test-name-pattern "inspect command"`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-03-25-inspect-batch-command.md`

## Related Research

- `docs/researches/research-2026-03-25-inspect-batch-mode.md`
