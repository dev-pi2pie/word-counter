---
title: "inspect default detector followup"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Address the detector-subpath inspect default mismatch reported in review.

## What Changed

- Updated `src/detector/inspect.ts` so `inspectTextWithDetector()` defaults to the WASM detector when `detector` is omitted.
- Preserved the existing `view: "engine"` validation so regex engine inspection still rejects unsupported combinations.
- Added a regression test in `test/detector-inspect.test.ts` covering the default pipeline path without an explicit detector.

## Validation

- `bun test test/detector-inspect.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
