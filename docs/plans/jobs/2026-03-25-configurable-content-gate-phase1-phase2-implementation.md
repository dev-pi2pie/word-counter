---
title: "configurable content gate phase 1 and phase 2 implementation"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Implement Phase 1 and Phase 2 of the configurable content gate plan:

- public `contentGate.mode` option plumbing for detector-subpath library APIs and CLI flows
- first-version detector policy semantics for `default`, `strict`, `loose`, and `off`

## What Changed

- Added the public detector option types:
  - `DetectorContentGateMode`
  - `DetectorContentGateOptions`
- Extended detector runtime option shapes so detector-subpath entrypoints accept:
  - `contentGate: { mode }`
- Added counting CLI support for `--content-gate default|strict|loose|off`.
- Added inspect CLI parsing and validation for `--content-gate default|strict|loose|off`.
- Threaded configured `contentGate` mode through the WASM detector resolution path.
- Implemented first-version Latin-route content gate semantics:
  - `default`
  - `strict`
  - `loose`
  - `off`
- Kept non-applicable routes as truthful no-op evaluations with:
  - `applied: false`
  - `passed: true`
  - `policy: "none"`
- Added regression coverage for:
  - detector policy mode behavior
  - CLI parsing and invalid mode handling
  - wasm counting CLI wiring
  - wasm inspect CLI wiring
  - detector-subpath runtime wiring
  - detector-subpath published type coverage
- Sent the test changes to `test_reviewer` and addressed the review findings by strengthening wasm-path coverage.

## Validation

- `bun test test/word-counter-detector.test.ts test/detector-policy.test.ts test/detector-inspect.test.ts test/command-inspect.test.ts test/command-detector.test.ts test/package-types.test.ts`
- `bun run type-check`
- `bun run lint`
- `bun run format:check`
- Attempted `bun run build`
  - TypeScript bundling and published type output completed.
  - The final wasm-pack optimization step failed in the sandbox with `Operation not permitted (os error 1)`.
