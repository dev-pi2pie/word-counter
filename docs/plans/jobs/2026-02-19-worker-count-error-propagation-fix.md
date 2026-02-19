---
title: "Worker count error propagation fix"
created-date: 2026-02-19
modified-date: 2026-02-19
status: completed
agent: Codex
---

## Summary

Fixed worker `--jobs > 1` behavior so count-time failures are surfaced as fatal errors instead of being converted into skip records.

## What Changed

- Updated worker error handling in `src/cli/batch/jobs/worker/count-worker.ts`.
- Separated file read failures from counting failures:
  - file read failures keep existing behavior (`skip`, except `EMFILE`/`ENFILE` as fatal)
  - counting/configuration failures now always return `fatal` to the worker pool
- Added regression test in `test/command.test.ts`:
  - `treats invalid counting options as fatal in worker route`
  - verifies `--latin-tag invalid_tag` is surfaced in the `--jobs 4` path.
- Added confidence test for empty-file contract in `test/command.test.ts`:
  - `keeps empty files as zero-count inputs when --jobs>1`
  - verifies parity between `--jobs 1` and `--jobs 4` with an empty file present.

## Validation

- `bun test test/command.test.ts`
- `bun test`
