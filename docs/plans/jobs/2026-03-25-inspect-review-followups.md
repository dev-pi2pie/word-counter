---
title: "inspect review followups"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Address review findings in the new inspect surface and record the verification work.

## What Changed

- Updated `src/detector/inspect.ts` so library `inspectTextWithDetector()` preserves engine requests:
  - defaults `view: "engine"` to the WASM detector when no detector is provided
  - rejects unsupported `detector: "regex"` plus `view: "engine"` combinations instead of silently returning a pipeline result
- Updated `src/cli/inspect/run.ts` so standard engine output uses bounded previews instead of printing full sampled text.
- Added regression coverage for:
  - library engine-view defaulting and validation
  - bounded standard engine output for large `--path` inputs

## Validation

- `bun test test/detector-inspect.test.ts`
- `bun test test/command.test.ts --test-name-pattern "inspect command|CLI doctor diagnostics|detector mode"`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
