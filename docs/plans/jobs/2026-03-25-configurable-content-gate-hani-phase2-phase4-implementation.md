---
title: "configurable content gate hani phase 2 through phase 4 implementation"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Complete the remaining Hani-specific Phase 2 through Phase 4 work for configurable `contentGate` behavior.

## What Changed

- Extended Hani detector policy so mode selection now affects Hani eligibility even though Hani `contentGate` remains a truthful no-op policy:
  - `default` keeps the existing Hani diagnostic-sample threshold
  - `strict` raises the Hani diagnostic-sample threshold
  - `loose` uses a Han-focused short-window threshold so idiom-length samples can become eligible
  - `off` stays aligned with `default` Hani eligibility and bypasses only gate evaluation
- Kept Hani `contentGate` disclosure stable across all modes:
  - `contentGate.applied = false`
  - `contentGate.policy = "none"`
  - `qualityGate` remains the legacy compatibility alias in debug and detector-evidence payloads
- Added Hani-specific regression coverage for the documented fixtures:
  - `世界` stays ineligible in `default|strict|loose|off`
  - `四字成語` becomes eligible only in `loose`
  - borrowed Japanese context alone does not make `こんにちは、世界！` eligible in `loose`
  - a longer borrowed-context Hani sample stays eligible in `default|off`, falls back in `strict`, and does not treat `loose` as a context-only shortcut
- Covered the Hani mode behavior across:
  - detector policy tests
  - inspect library tests
  - inspect CLI JSON and standard output tests
  - counting CLI debug and detector-evidence tests
  - detector-subpath runtime entrypoint tests
- Sent the Hani test-related changes to `Probe` for review, fixed the reported coverage gaps, and re-reviewed the updated scope.

## Validation

- `bun test test/detector-policy.test.ts test/detector-inspect.test.ts test/command-inspect.test.ts test/command-detector.test.ts test/word-counter-detector.test.ts test/package-types.test.ts`
- `bun run type-check`
- `bun run lint`
- `bun run format:check`
