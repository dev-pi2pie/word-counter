---
title: "configurable content gate phase 2 through phase 4 threshold mode implementation"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Implement the reopened Phase 2 through Phase 4 scope for configurable `contentGate` behavior after the plan changed from gate-only modes to threshold-coupled detector modes.

## What Changed

- Updated Latin detector policy so `contentGate` modes now affect eligibility thresholds as well as gate evaluation:
  - `default` keeps the current `24`-character Latin eligibility threshold
  - `strict` raises the Latin eligibility threshold to `30`
  - `loose` lowers the Latin eligibility threshold to `20`
  - `off` keeps the default Latin eligibility threshold and bypasses only `contentGate`
- Kept Han-route detector policy as a truthful no-op for `contentGate` mode application.
- Threaded the configured mode into route eligibility evaluation so inspect, debug, and detector-evidence surfaces report the actual threshold used for the current mode.
- Added detector-policy regressions that prove:
  - `strict` can make a Latin window ineligible
  - `loose` can make a Latin window eligible
  - `off` keeps `default` eligibility thresholds
  - non-applicable routes keep honest no-op behavior
- Added inspect-library and inspect-CLI regressions that prove threshold-coupled mode changes show up in:
  - `eligibility.minScriptChars`
  - `eligibility.passed`
  - engine execution state
  - fallback reasons
  - canonical `contentGate` disclosure
- Added count-CLI and detector-subpath runtime regressions that prove:
  - `strict` changes eligibility, not just gate acceptance
  - `loose` changes eligibility, not just gate acceptance
  - `off` changes only `contentGate` evaluation while preserving eligibility
  - legacy debug and detector-evidence payloads still expose `qualityGate`
- Sent the new test-related changes to `Telescope` for review and addressed the two reported coverage gaps:
  - added `loose|off` runtime evidence coverage for `segmentTextByLocaleWithDetector()` and `countSectionsWithDetector()`
  - added standard inspect-output coverage for `strict` and `loose`
- Final test review reported no material findings remaining.

## Validation

- `bun test test/detector-policy.test.ts test/detector-inspect.test.ts test/command-inspect.test.ts test/command-detector.test.ts test/word-counter-detector.test.ts test/package-types.test.ts`
- `bun run type-check`
- `bun run lint`
- `bun run format:check`
