---
title: "configurable content gate behavior"
created-date: 2026-03-25
modified-date: 2026-03-25
status: draft
agent: Codex
---

## Goal

Implement first-version user-configurable `contentGate` behavior for both CLI and library users while keeping `contentGate` as the canonical diagnostic field and preserving the legacy `qualityGate` compatibility alias only where it already exists.

## Context

- The prerequisite detector-policy, inspect, inspect-batch, and structure-refactor work is already complete.
- The linked research settles the first-version product direction:
  - expose one shared global mode set in CLI and library forms
  - use discrete modes instead of numeric thresholds
  - keep `contentGate` as the canonical diagnostic field
  - preserve `qualityGate` only as a compatibility alias in legacy payloads
- The implementation must reuse the existing route-aware detector policy model rather than reopening detector architecture.
- In library form, v1 applies to the detector subpath entrypoints that already execute detector policy:
  - `wordCounterWithDetector`
  - `segmentTextByLocaleWithDetector`
  - `countSectionsWithDetector`
  - `inspectTextWithDetector`
- The repo now has project-level `oxlint` and `oxfmt` scripts and config.
  - implementation validation should keep changed files lint-clean and format-clean

## Scope

- In scope:
  - add a first-version public `contentGate` mode surface to the detector-subpath library entrypoints that execute detector policy
  - add a first-version public `--content-gate` mode surface to the CLI
  - implement the mode set:
    - `default`
    - `strict`
    - `loose`
    - `off`
  - thread the configured mode through detector-policy evaluation
  - preserve truthful no-op behavior for routes where `contentGate` is not meaningfully applied
  - surface the configured mode and resulting gate evaluation through inspect and existing debug/evidence payloads where applicable
  - preserve the existing legacy `qualityGate` compatibility alias in payloads that already expose it
  - add regression coverage for CLI, library, inspect, and compatibility behavior
  - update README and detector-facing docs for the new public surface
- Out of scope:
  - route-specific gate tuning
  - public numeric threshold exposure
  - changes to base regex/script segmentation behavior
  - detector-engine changes unrelated to policy-mode application
  - removing the `qualityGate` compatibility alias in this phase

## Decisions Settled For This Plan

- The first public configuration surface is global, not route-specific.
- The first public contract is:

```ts
contentGate?: {
  mode?: "default" | "strict" | "loose" | "off";
}
```

```bash
--content-gate default|strict|loose|off
```

- `default` keeps the current fixture-backed project policy.
- `strict` tightens acceptance so more borderline windows fall back.
- `loose` relaxes acceptance so more borderline windows may upgrade.
- `off` bypasses `contentGate` evaluation only.
- `off` does not disable route eligibility, corroboration, or fallback-tag behavior.
- Non-applicable routes must accept any supported mode without validation failure.
- Non-applicable routes must report truthful no-op state in diagnostic output:
  - `contentGate.applied = false`
  - `contentGate.policy = "none"`
- `contentGate` remains the canonical gate field for inspect and new diagnostic disclosure.
- `qualityGate` remains only as a derived compatibility alias in legacy debug/evidence payloads that already expose it.
- Public semantics must be fixture-backed and outcome-based rather than threshold-based.

## Phase Task Items

### Phase 1 - Public Contract And Option Plumbing

- [x] Add a public `contentGate.mode` option shape to the detector-subpath option types consumed by:
  - `wordCounterWithDetector`
  - `segmentTextByLocaleWithDetector`
  - `countSectionsWithDetector`
  - `inspectTextWithDetector`
- [x] Add CLI parsing and validation for `--content-gate default|strict|loose|off`.
- [x] Define how the configured mode flows from detector-subpath options and CLI options into detector-policy execution.
- [x] Preserve current behavior when the option is omitted so `default` remains the effective behavior.
- [x] Reject unsupported mode values with clear CLI and library validation behavior.

Validation for this phase:

- library type coverage for the new option shape
- CLI parsing tests for each supported mode
- CLI validation tests for invalid mode values
- regression checks proving omitted configuration preserves existing behavior

### Phase 2 - Detector Policy Mode Semantics

- [x] Extend route-aware detector policy evaluation so `contentGate` can apply `default`, `strict`, `loose`, and `off`.
- [x] Define fixture-backed behavior differences for `strict` and `loose` on routes where `contentGate` is meaningful.
- [x] Ensure `off` bypasses only `contentGate` evaluation and leaves route eligibility, corroboration, and fallback intact.
- [x] Ensure non-applicable routes accept the configured mode while remaining truthful no-op evaluations.
- [x] Keep policy implementation internal and avoid exposing raw thresholds in the public contract.

Validation for this phase:

- detector-policy tests covering each mode on content-gated routes
- regression tests proving `off` changes only gate evaluation, not unrelated policy stages
- tests for non-applicable routes showing accepted config plus `applied = false`
- fixture-backed comparisons demonstrating distinct `default`, `strict`, and `loose` outcomes

### Phase 3 - Diagnostic And Compatibility Surfaces

- [x] Update inspect output to disclose the configured mode wherever `contentGate` is reported.
- [x] Update debug and detector-evidence payload generation so canonical `contentGate` output reflects the configured mode.
- [x] Preserve `qualityGate` only as the derived compatibility alias in payloads that already expose it.
- [x] Avoid adding `qualityGate` to new inspector-only payloads.
- [x] Ensure no-op routes report the configured mode with honest non-application state.

Validation for this phase:

- inspect JSON and standard-output tests covering configured-mode disclosure
- legacy debug/evidence regression tests proving `qualityGate` compatibility remains intact
- tests proving new inspector payloads use `contentGate` as the canonical field
- tests for non-applicable routes showing truthful inspect/debug disclosure

### Phase 4 - CLI And Library Behavior Coverage

- [x] Add CLI behavior tests for `--content-gate` across count and inspect flows where detector policy is exercised.
- [x] Add library tests covering configurable `contentGate` on:
  - `wordCounterWithDetector`
  - `segmentTextByLocaleWithDetector`
  - `countSectionsWithDetector`
  - `inspectTextWithDetector`
- [x] Verify batch inspect and single-input inspect both report the configured mode consistently.
- [x] Verify the public option works with existing detector-related options without changing unrelated behavior.
- [x] Add compatibility-focused regressions for older debug/evidence consumers that still read `qualityGate`.

Validation for this phase:

- `bun test test/command.test.ts`
- detector and library-focused tests for configured-mode behavior
- inspect batch and single-input parity checks
- regression tests proving unchanged behavior outside content-gate policy differences

### Phase 5 - Docs, Jobs, And Release Readiness

- [ ] Update README usage examples for library and CLI `contentGate` configuration.
- [ ] Update detector-facing docs and any relevant schema/contract docs to explain configured-mode behavior.
- [ ] Record implementation progress in job records under `docs/plans/jobs/`.
- [ ] Add release-note-ready documentation of the new public option and compatibility behavior.
- [ ] Run final regression, lint, format-check, type-check, and build verification before closing the plan.

Validation for this phase:

- doc review against the settled research contract
- `bun run lint`
- `bun run format:check`
- `bun run type-check`
- `bun run build`
- targeted regression audit across CLI, library, inspect, and compatibility payloads

## Compatibility Gates

- [ ] Omitted configuration preserves current `default` behavior.
- [ ] `contentGate` remains the canonical diagnostic field.
- [ ] `qualityGate` remains available only in legacy payloads that already expose it.
- [ ] New inspector-only payloads do not add `qualityGate`.
- [ ] `off` disables only gate evaluation and does not disable route eligibility, corroboration, or fallback.
- [ ] Non-applicable routes accept all supported modes without lying about gate application.
- [ ] No public numeric threshold controls are introduced in this phase.
- [ ] Changed files remain clean under the configured lint and format scripts.

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/plans/plan-2026-03-25-inspect-batch-command.md`
- `docs/plans/plan-2026-03-25-typescript-structure-modularization.md`

## Related Research

- `docs/researches/research-2026-03-25-configurable-content-gate-behavior.md`
- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-03-25-inspect-batch-mode.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-03-24-detector-evidence-debug-surface.md`

## Related Jobs

- `docs/plans/jobs/2026-03-25-configurable-content-gate-phase1-phase2-implementation.md`
- `docs/plans/jobs/2026-03-25-configurable-content-gate-phase3-phase4-implementation.md`
