---
title: "Worker crash fallback fix"
created-date: 2026-02-19
status: completed
agent: Codex
---

## Summary

Addressed review feedback about worker crash handling in the batch `--jobs > 1` route.

## What Changed

- Updated fallback classification in `src/cli/batch/jobs/load-count-worker-experimental.ts`.
- Removed `"Worker exited before completing assigned tasks"` from fallback-friendly message matching.
- Result: worker runtime exits during active tasks now surface as failures instead of being silently converted to async fallback execution.

## Why

Mid-run worker crashes indicate runtime instability, not route unavailability. Surfacing these errors preserves diagnostics and prevents silent masking of worker executor faults.

## Validation

- `bun test test/command.test.ts`
