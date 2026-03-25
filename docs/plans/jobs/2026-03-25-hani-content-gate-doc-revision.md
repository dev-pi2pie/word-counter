---
title: "hani content gate doc revision"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Revise the configurable `contentGate` research and plan docs so Hani is no longer described as a permanently fixed no-op route in the public mode design.

## What Changed

- Updated the research doc to state that Hani should participate in `default|strict|loose` through eligibility variation even while Hani `contentGate` remains `policy = "none"`.
- Documented the intended Hani `loose` direction as an idiom-length path, with an initial calibration target of roughly four Han-bearing characters kept as an internal policy detail.
- Updated the plan doc so the remaining open scope is explicit:
  - Hani-specific threshold calibration
  - truthful Hani inspect/debug disclosure
  - Hani-focused CLI and library regressions
- Kept user-facing runtime docs unchanged because the Hani mode expansion is still planned work rather than implemented behavior.

## Validation

- doc review requested from `docs_reviewer`
- revised the plan after review so:
  - Hani user-facing runtime docs stay deferred until implementation ships
  - Hani `loose` calibration now has explicit fixture-backed expected outcomes for `世界`, `四字成語`, and `こんにちは、世界！`
