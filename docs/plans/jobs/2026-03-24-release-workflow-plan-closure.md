---
title: "release workflow plan closure"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Confirm whether `docs/plans/plan-2026-03-24-release-workflow-consolidation.md` still had unresolved work after the `v0.1.5-canary.2` integration point and update the plan to match the repository state.

## Findings

- Tag `v0.1.5-canary.2` points to merge commit `fde1039` on 2026-03-24.
- That merge already included the consolidation and follow-up workflow changes:
  - `dd0274e` added Rust caching and package-content verification.
  - `37084fe` consolidated publish workflows into `release.yml` and removed the duplicated publish workflow files.
  - `04e05ca` fixed CI type-check behavior for Bun tests.
  - `5052a8c` reduced CI triggering to pull requests only.
- The current workflow set contains only `.github/workflows/ci.yml` and `.github/workflows/release.yml`.
- `.github/workflows/release.yml` still supports `workflow_dispatch` inputs for `tag` and `shallow_since`, verifies package contents in `prepare`, uploads `release-package-${tag}`, and has both publish jobs consume that artifact.
- `scripts/verify-package-contents.mjs` explicitly requires:
  - `dist/wasm-language-detector/language_detector.js`
  - `dist/wasm-language-detector/language_detector_bg.wasm`

## What Changed

- Marked `docs/plans/plan-2026-03-24-release-workflow-consolidation.md` as completed.
- Replaced the stale remaining rollout items with completed confirmation items aligned with the workflow state that shipped around `v0.1.5-canary.2`.
- Updated the plan text so its CI trigger description matches the later pull-request-only cleanup.

## Related Plans

- `docs/plans/plan-2026-03-24-release-workflow-consolidation.md`
