---
title: "content gate threshold mode revision"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Revise the configurable content gate research and implementation plan so the first-version mode design treats `default`, `strict`, and `loose` as policy-wide detector modes rather than content-gate-only toggles.

## What Changed

- Updated the research doc to state that:
  - `default`, `strict`, and `loose` should affect eligibility thresholds and content-gate behavior together on applicable routes
  - `off` should remain narrower and bypass only `contentGate`
  - threshold numbers remain internal implementation details rather than public knobs
- Reopened the implementation plan and changed its status from `completed` to `active`.
- Marked Phase 2 through Phase 5 task items and compatibility gates back to pending where the revised mode design is not honestly implemented yet.
- Kept the public contract itself unchanged:
  - `--content-gate default|strict|loose|off`
  - `contentGate: { mode }`

## Why This Revision Was Needed

- A content-gate-only mode scale makes `strict` and `loose` hard to observe on many realistic documents.
- The current internal eligibility thresholds already materially affect detector behavior.
- Coupling eligibility and gate behavior makes the public mode scale more meaningful without exposing raw threshold values publicly.
