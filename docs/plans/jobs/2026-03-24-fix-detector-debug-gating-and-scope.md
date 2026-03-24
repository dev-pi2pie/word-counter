---
title: "fix detector debug gating and scope"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Summary

Addressed two review findings in the detector debug pipeline:

- prevented worker and async batch detector debug contexts from being created when `--debug` is not enabled
- marked per-file batch detector events as `scope: "file"` in the shared debug event envelope

## What Changed

- updated `src/cli/batch/run.ts` to:
  - gate detector debug callbacks on `debug.enabled`
  - wrap batch detector events with explicit `scope: "file"`
- updated `src/cli/batch/jobs/load-count.ts` to stop creating fallback detector summaries when no debug context is requested
- updated `src/cli/batch/jobs/load-count-worker.ts` and `src/cli/batch/jobs/worker/count-worker.ts` so worker-side detector debug state is only created when debug forwarding is enabled
- updated `src/cli/debug/channel.ts` to accept an explicit event scope override
- added regression coverage in `test/command.test.ts` for:
  - file-scoped detector events in async and worker batch executors
  - absence of worker detector debug summaries when no debug callback is provided

## Verification

- ran `bun test test/command.test.ts`
