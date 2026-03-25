---
title: "configurable content gate phase 5 docs and closure"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Complete Phase 5 of the configurable content gate plan:

- finish user-facing and contract documentation
- record a release-note-ready summary
- close plan verification

## What Changed

- Updated `README.md` with:
  - CLI examples for `--content-gate`
  - inspect examples for configured content gate modes
  - detector-subpath usage showing `contentGate: { mode }`
  - detector mode notes that explain canonical `contentGate` and legacy `qualityGate`
- Updated `docs/language-detection-support-guide.md` with the current public content gate surface and route behavior.
- Updated `docs/schemas/detector-inspector-output-contract.md` to document:
  - `--content-gate` in inspect CLI shape
  - `contentGate.mode` in inspect payloads
  - standard-output disclosure expectations
- Updated `docs/schemas/debug-event-stream-contract.md` to document `contentGate.mode` in legacy debug/evidence payloads.

## Release Notes Draft

Release-ready summary:

- Added user-configurable `contentGate` modes for the WASM detector path in both CLI and detector-subpath APIs.
- Added `--content-gate default|strict|loose|off` to the CLI and `contentGate: { mode }` to detector-subpath entrypoints.
- Extended inspect, debug, and detector-evidence disclosure so canonical `contentGate` output reports the configured mode.
- Preserved `qualityGate` only as a compatibility alias in existing debug and detector-evidence payloads.

## Validation

- `bun test test/word-counter-detector.test.ts test/detector-policy.test.ts test/detector-inspect.test.ts test/command-inspect.test.ts test/command-detector.test.ts test/package-types.test.ts`
- `bun run type-check`
- `bun run lint`
- `bun run format:check`
- `bun run build`
  - completed successfully after sandbox escalation because the wasm optimization step requires permissions not available in the default sandbox
