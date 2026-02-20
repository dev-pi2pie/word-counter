---
title: "Batch jobs route cleanup and diagnostics noise policy"
created-date: 2026-02-20
modified-date: 2026-02-20
status: completed
agent: Codex
---

## Goal

Finalize batch jobs routing by removing the legacy `load-only` execution route, and define a unified diagnostics noise policy that keeps default output practical while preserving detailed debug observability.

## Scope

- In scope:
  - Remove active `load-only` route usage for `--jobs=1`.
  - Keep only `load+count` execution family:
    - main-thread async `load+count` for baseline (`jobs=1`)
    - worker `load+count` for concurrent route (`jobs>1`) with internal fallback
  - Rename internal `experimental` route files to stable names aligned with current policy.
  - Define and implement unified diagnostics noise policy for warnings/debug/verbose behavior.
  - Update tests and docs for route and diagnostics behavior.
  - Record user-visible diagnostics behavior changes in `docs/breaking-changes-notes.md`.
- Out of scope:
  - Counting algorithm or total semantics changes.
  - New doctor-style diagnostics command.

## Task Items

### 1) Route Simplification

- [x] Remove strategy branch that routes `jobs=1` to `load-only`.
- [x] Rebase baseline execution to async/main-thread `load+count`.
- [x] Keep worker route for `jobs>1` plus internal async fallback.
- [x] Move any reusable file read/skip classification helpers from `src/cli/batch/jobs/load-only.ts` into shared jobs utilities.
- [x] Remove `src/cli/batch/jobs/load-only.ts` after helper extraction.

### 2) Naming and Structure Cleanup

- [x] Rename `src/cli/batch/jobs/load-count-experimental.ts` to stable internal naming.
- [x] Rename `src/cli/batch/jobs/load-count-worker-experimental.ts` to stable internal naming.
- [x] Update imports, tests, and docs to remove `experimental` wording where behavior is now default policy.

### 3) Diagnostics Noise Policy

- [x] Define explicit message tiers:
  - errors (always shown)
  - warnings (shown by default, suppressible)
  - debug events (`--debug`; per-item details gated by `--verbose`)
- [x] Keep jobs-limit advisory warning in warning tier.
- [x] Keep worker fallback notification in warning tier when emitted to terminal.
- [x] Introduce warning suppression flag for users who want quiet operational runs.
- [x] Reconcile `--quiet-skips` behavior with the new warning policy and keep semantics unambiguous.
- [x] Align README/help text and tests with the finalized diagnostics contract.

### 4) Validation

- [x] Parity tests across no `--jobs`, `--jobs=1`, and `--jobs>1` remain green.
- [x] Diagnostics tests cover default warning visibility and warning suppression.
- [x] Run `bun test` and targeted CLI smoke checks.

## Related Research

- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`

## Related Plans

- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
