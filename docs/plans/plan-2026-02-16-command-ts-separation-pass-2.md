---
title: "command.ts separation pass 2 boundary plan"
created-date: 2026-02-16
modified-date: 2026-02-16
status: completed
agent: Codex
---

## Goal

Define an additional modularization pass for `src/command.ts` to reduce file weight while preserving current CLI behavior and compatibility exports.

## Context

`src/command.ts` currently spans multiple responsibilities in a single file (~599 lines):

- CLI program definition (`commander` option wiring)
- runtime guard/error policy for debug/report options
- single-input execution path
- batch execution path (progress, diagnostics, skip reporting)
- output normalization for base-mode compatibility (`--total-of` auto-collection behavior)

This concentration increases maintenance risk and slows targeted changes.

## Re-check Findings

- `runCli` currently owns both option parsing and all runtime orchestration.
- Base-output normalization helpers are CLI-contract logic, but they are embedded in the command bootstrap file.
- Single-input and batch-input paths are structurally distinct and can be isolated with stable interfaces.
- Existing compatibility exports from `src/command.ts` (`buildBatchSummary`, `loadBatchInputs`, `resolveBatchFilePaths`) must remain intact.

## Proposed Refactor Pass (Additive, Compatibility-First)

- Extract CLI option metadata/registration into `src/cli/program/options.ts`.
- Extract runtime option normalization and guard checks into `src/cli/runtime/options.ts`.
- Extract single-input execution into `src/cli/runtime/single.ts`.
- Extract batch execution into `src/cli/runtime/batch.ts`.
- Extract base-output normalization helpers into `src/cli/output/normalize-base.ts`.
- Keep `src/command.ts` as a thin composition boundary and compatibility export surface.

## Compatibility Invariants

- Keep `runCli(argv?, runtime?)` signature and behavior unchanged.
- Keep all existing CLI flags, defaults, aliases, and validation messages unchanged.
- Keep `stdout`/`stderr` routing contracts unchanged across `standard`/`raw`/`json` modes.
- Keep compatibility exports from `src/command.ts` unchanged.
- Keep existing tests in `test/command.test.ts` green without changing assertions for legacy paths.

## Implementation Plan

- [x] Introduce extracted modules with no behavior changes.
- [x] Move option wiring first, then runtime handlers, then normalization helpers.
- [x] Keep `src/command.ts` orchestrating only composition and export wiring.
- [x] Add/adjust focused unit tests for extracted modules where useful; preserve existing integration tests.
- [x] Run full test suite and compare behavior against current contracts.

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
- `docs/plans/plan-2026-02-15-command-modularization-and-extension-filters.md`
- `docs/plans/plan-2026-02-16-char-collector-mode.md`
