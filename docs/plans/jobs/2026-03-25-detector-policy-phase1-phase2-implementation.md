---
title: "detector policy phase 1 and phase 2 implementation"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Implement Phase 1 and Phase 2 of the detector policy refactor plan:

- route-aware detector policy objects
- structured `contentGate` adoption with debug/evidence compatibility aliasing
- conservative adjacent-`ja` borrowing for mixed `und-Hani` detector samples
- internal inspector contract types and schema groundwork

## What Changed

- Refactored the WASM detector flow to use route-aware detector policy objects in `src/detector/policy.ts`.
- Split detector policy responsibilities into:
  - diagnostic sample construction
  - route eligibility
  - `contentGate` evaluation
  - reliable and corroborated acceptance
  - fallback tag selection
- Added conservative detector-only adjacent-`ja` borrowing for `und-Hani` windows.
  - Borrowing uses directly adjacent `ja` chunks only.
  - The accepted locale still projects back only onto the original ambiguous span.
- Updated `src/detector/whatlang-map.ts` so Hani-route Japanese remaps accept `jpn` results reported with `Hiragana` or `Katakana`.
- Added internal inspector contract types in `src/detector/inspect-types.ts`.
- Added `docs/schemas/detector-inspector-output-contract.md`.
- Updated existing debug/evidence contract docs to document `contentGate` plus the temporary `qualityGate` compatibility alias.
- Added regression coverage for:
  - route-policy unit behavior
  - mixed Japanese/Hani detector behavior
  - debug/evidence payload compatibility fields

## Validation

- `bun test test/detector-policy.test.ts test/word-counter.test.ts test/command.test.ts test/detector-interop.test.ts`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
