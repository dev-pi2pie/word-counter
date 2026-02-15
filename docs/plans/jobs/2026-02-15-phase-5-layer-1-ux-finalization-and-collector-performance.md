---
title: "Phase 5 Layer 1 UX finalization and collector performance"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Implement Phase 5 Layer 1 UX/performance improvements before `--total-of` work:

- add a finalization stage after counting so `100%` does not imply immediate completion
- show a transient `Finalizing aggregate...` indicator in standard batch mode
- reduce collector merged-mode post-count latency by avoiding segment retention/copying when not needed
- add regression coverage and debug stage timing diagnostics

## What Changed

- Updated progress reporter (`src/cli/progress/reporter.ts`):
  - added `startFinalizing()`
  - added finalization line rendering: `Finalizing aggregate... elapsed mm:ss.t`
  - preserved transient clear behavior and keep-visible behavior (`--debug`, `--keep-progress`)
- Updated batch runner (`src/cli/batch/run.ts`):
  - wired finalization transition through `buildBatchSummary` callback
  - added stage timing diagnostics on debug channel:
    - `resolve`
    - `load`
    - `count`
    - `finalize`
  - added `preserveCollectorSegments` execution option
- Updated CLI wiring (`src/command.ts`):
  - batch runs now preserve collector segments only for JSON output
- Updated batch aggregation (`src/cli/batch/aggregate.ts`):
  - added `onFinalizeStart` callback
  - added `preserveCollectorSegments` policy
  - collector merge now skips segment copying when segment preservation is disabled
  - collector segments are compacted for non-JSON batch outputs
- Updated tests (`test/command.test.ts`):
  - progress output now validates finalization indicator presence
  - debug diagnostics test now validates stage timing diagnostics (`resolve`, `load`, `count`, `finalize`)
  - added collector compaction test for batch aggregation
  - added merged JSON collector test to ensure segment retention contract remains intact

## Validation

- `bun test test/command.test.ts`
- `bun test`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
