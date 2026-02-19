---
title: "Clamp over-limit --jobs requests to suggested host cap"
created-date: 2026-02-19
modified-date: 2026-02-19
status: completed
agent: Codex
---

## Goal

Add a guardrail so `--jobs` values above host `suggestedMaxJobs` are capped automatically, while still warning the user.

## Changes

- Added `clampRequestedJobs(requestedJobs, limits)` in `src/cli/batch/jobs/limits.ts`.
- Updated advisory warning text in `src/cli/batch/jobs/limits.ts` to explicitly state the capped runtime value.
- Applied clamping in `src/cli/runtime/batch.ts` before strategy selection and batch execution.
- Styled the over-limit advisory warning with `pc.yellow(...)` in `src/cli/runtime/batch.ts` for consistency with skip diagnostics.
- Updated `README.md` batch concurrency policy to describe warning + safety cap behavior.
- Extended `test/command.test.ts` to assert:
  - warning includes the capped `--jobs` value
  - debug strategy event reports the capped jobs value

## Why

This prevents accidental over-concurrency from user-provided values that exceed host guidance while preserving explicit diagnostics.

## Verification

- `bun test test/command.test.ts`
- `bun run type-check`
