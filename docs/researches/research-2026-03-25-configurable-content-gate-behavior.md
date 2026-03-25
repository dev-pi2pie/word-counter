---
title: "configurable content gate behavior"
created-date: 2026-03-25
modified-date: 2026-03-25
status: draft
agent: codex
---

## Goal

Settle whether `contentGate` should be exposed as a user-configurable policy surface now that detector-policy, inspect, inspect-batch, and recent refactor work are complete.

## Key Findings

- The implementation prerequisites are already in place.
  - route-aware detector policy objects exist
  - inspect library and CLI surfaces exist
  - inspect batch mode exists
  - the recent TypeScript refactor lowered follow-up implementation risk
- `contentGate` should already be treated as part of the public diagnostic story.
  - `contentGate` is the canonical gate field for current inspect and debug disclosure
  - `qualityGate` still needs to remain as a compatibility alias only in legacy payloads that already exposed that older field
- The main remaining question is not observability.
  - inspect and debug output now make gate behavior explainable
  - users can see whether the gate applied, which policy ran, and whether it passed
- The current internal detector eligibility thresholds already shape how conservative the WASM path is.
  - `und-Latn` currently requires at least `24` script-bearing Latin characters
  - `und-Hani` currently requires at least `12` script-bearing Han characters
  - those thresholds are currently internal-only, but they materially affect whether the engine runs at all
- Route asymmetry still exists, but it does not block a first public configuration surface if the contract is explicit.
  - some detector routes meaningfully apply `contentGate`
  - other routes should accept the configured mode but report that the gate was not applied
- A small discrete mode set is still the safest public contract.
  - it is easier to explain than numeric thresholds
  - it leaves room for fixture-backed internal tuning without exposing raw detector heuristics
- A gate-only mode scale is weaker than a policy-wide mode scale.
  - if `default`, `strict`, and `loose` only change the Latin content gate, many realistic documents will show little or no visible difference between them
  - coupling those modes to eligibility thresholds as well as gate behavior makes the public scale more meaningful without exposing raw threshold knobs

## Settled Decision

- Implement user-configurable `contentGate` behavior.
- Expose the same mode set in both CLI and library forms.
- Use `contentGate` as the canonical gate field in inspect and debug output.
- Keep `qualityGate` only as a compatibility alias in legacy payloads that already expose it.
- Keep the public surface mode-based, not threshold-based.
- Keep the configuration global in the first version, not route-specific.
- Treat `default`, `strict`, and `loose` as policy-wide detector modes for applicable routes:
  - they should affect eligibility thresholds and content-gate behavior together
- Treat `off` as a narrower escape hatch:
  - it bypasses `contentGate` only
  - it does not loosen eligibility thresholds

## Recommended First-Version Contract

Library:

```ts
contentGate?: {
  mode?: "default" | "strict" | "loose" | "off";
}
```

CLI:

```bash
--content-gate default|strict|loose|off
```

## Recommended First-Version Rules

- `default` is the current fixture-backed project policy, including the current detector eligibility thresholds.
- `strict` tightens policy in two places on routes where `contentGate` is meaningful:
  - it raises eligibility thresholds
  - it tightens content-gate acceptance so more borderline windows fall back
- `loose` relaxes policy in two places on routes where `contentGate` is meaningful:
  - it lowers eligibility thresholds
  - it relaxes content-gate acceptance so more borderline windows may upgrade
- `off` bypasses `contentGate` evaluation only.
- `off` keeps the same eligibility thresholds as `default`.
- `off` does not disable route eligibility, corroboration, or fallback-tag behavior.
- Non-applicable routes must accept the configured mode without error.
- Non-applicable routes must report honest no-op behavior in inspect and debug output:
  - `contentGate.applied = false`
  - `contentGate.policy = "none"`
- Routes where `contentGate` is meaningful should apply the selected mode normally and disclose the resulting evaluation.
- Routes where the configured mode changes eligibility should surface that effect truthfully through inspect/debug output, including cases where engine execution changes from `executed` to `notEligible` or vice versa.
- New diagnostic surfaces should use `contentGate` as the canonical field.
- Legacy debug/evidence payloads that already exposed `qualityGate` should continue to emit the derived compatibility alias during the compatibility window.

## Why This Should Be Implemented Now

- The project now has the inspect and debug surfaces needed to explain the behavior clearly.
- The internal detector-policy split means the work can be implemented without reopening the broader detector architecture.
- A mode-based contract is concrete enough to document and test now.
- Users who need stricter, looser, or disabled gate behavior no longer need to rely on forks or internal-only changes.

## Follow-Up Planning Constraints

The follow-up implementation plan should keep these boundaries:

- define mode behavior through fixture-backed outcomes, not public numeric thresholds
- cover both CLI and library surfaces in one contract
- preserve `contentGate` as the canonical diagnostic field
- preserve `qualityGate` only as a compatibility alias where it already exists
- keep first-version behavior global, with truthful no-op reporting on non-applicable routes
- allow internal eligibility thresholds to vary by mode even though threshold numbers remain private implementation details
- keep `off` limited to content-gate bypass rather than treating it as a global detector-lax mode
- avoid route-specific tuning or threshold exposure in v1

## Related Plans

- `docs/plans/plan-2026-03-25-configurable-content-gate-behavior.md`
- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/plans/plan-2026-03-25-inspect-batch-command.md`
- `docs/plans/plan-2026-03-25-typescript-structure-modularization.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-03-25-inspect-batch-mode.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-03-24-detector-evidence-debug-surface.md`

## Related Job Records

- `docs/plans/jobs/2026-03-25-detector-policy-phase1-phase2-implementation.md`
- `docs/plans/jobs/2026-03-25-detector-inspect-phase3-phase4-implementation.md`
- `docs/plans/jobs/2026-03-25-inspect-batch-phase1-phase2-implementation.md`
- `docs/plans/jobs/2026-03-25-typescript-structure-phase5-phase6-implementation.md`
