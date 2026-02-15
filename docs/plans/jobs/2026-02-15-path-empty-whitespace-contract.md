---
title: "Clarify empty and whitespace --path contract"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Document and lock in the intended CLI behavior that readable `--path` files with empty or whitespace-only content are valid inputs and return zero word counts by default.

## What Changed

- Updated `README.md` to explicitly state:
  - readable text-like files are valid for `--path` even when empty or whitespace-only
  - those files contribute zero words by default
- Added CLI compatibility tests in `test/command.test.ts` for:
  - empty single `--path` file
  - whitespace-only single `--path` file
- Tests assert success behavior (no stderr errors) and zero-count outputs.

## Validation

- `bun test test/command.test.ts`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
