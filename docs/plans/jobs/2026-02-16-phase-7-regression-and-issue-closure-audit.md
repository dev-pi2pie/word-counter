---
title: "Phase 7 regression and issue-closure audit"
created-date: 2026-02-16
status: completed
agent: Codex
---

## Goal
Complete the final Phase 7 validation by running a full regression pass and re-checking closure evidence for `#17`, `#18`, `#19`, `#20`, `#24`, `#26`, and `#33`.

## Work Performed
- Ran `bun run test:ci` (build + full test suite).
- Ran CLI smoke checks on built output:
  - `node dist/esm/bin.mjs "Hello world"`
  - `node dist/esm/bin.mjs --format raw "Hello world"`
  - `node dist/esm/bin.mjs --format json "Hello 👋"`
  - `node dist/esm/bin.mjs --path examples/test-case-multi-files-support --no-progress`

## Regression Result
- `bun run test:ci` passed with `110 pass`, `0 fail`.
- CLI smoke outputs matched expected behavior for legacy single-input contracts and feature-path batch behavior.

## Issue Acceptance Re-check
- `#17` batch file counting:
  - Batch path resolution and aggregation coverage: `test/command.test.ts:90`, `test/command.test.ts:177`, `test/command.test.ts:327`.
- `#18` progress bar behavior:
  - Progress mode/flags coverage: `test/command.test.ts:428`, `test/command.test.ts:450`, `test/command.test.ts:461`, `test/command.test.ts:508`.
- `#19` selective totals via `--total-of`:
  - Total override and mode interactions: `test/command.test.ts:981`, `test/command.test.ts:994`, `test/command.test.ts:1006`, `test/command.test.ts:1096`.
- `#20` compatibility gates:
  - Legacy output/path compatibility coverage: `test/command.test.ts:1115`, `test/command.test.ts:1116`, `test/command.test.ts:1121`, `test/command.test.ts:1126`.
- `#24` language-tag hints and Han fallback:
  - Latin/Han hint precedence coverage: `test/command.test.ts:1187`, `test/command.test.ts:1200`, `test/command.test.ts:1234`, `test/command.test.ts:1265`.
  - User-facing docs: `README.md:68`, `README.md:75`, `README.md:533`.
- `#26` path resolution semantics:
  - Path/dedupe/filter coverage: `test/command.test.ts:90`, `test/command.test.ts:416`, `test/command.test.ts:847`.
  - Stable contract docs: `README.md:124`.
- `#33` `char-collector` mode:
  - Core mode behavior/alias coverage: `test/word-counter.test.ts:202`, `test/word-counter.test.ts:234`, `test/command.test.ts:1246`.
  - User-facing docs: `README.md:347`, `README.md:355`.

## Outcome
Phase 7 final regression and issue acceptance re-check completed. No blocking regressions were found.

## Related Plans
- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
