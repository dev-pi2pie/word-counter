---
title: "configurable content gate behavior"
created-date: 2026-03-25
modified-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Implement first-version user-configurable `contentGate` behavior for both CLI and library users while keeping `contentGate` as the canonical diagnostic field, preserving the legacy `qualityGate` compatibility alias only where it already exists, and treating `default|strict|loose` as policy-wide detector modes rather than gate-only toggles.

## Context

- The prerequisite detector-policy, inspect, inspect-batch, and structure-refactor work is already complete.
- The linked research settles the first-version product direction:
  - expose one shared global mode set in CLI and library forms
  - use discrete modes instead of public numeric thresholds
  - keep `contentGate` as the canonical diagnostic field
  - preserve `qualityGate` only as a compatibility alias in legacy payloads
  - let `default|strict|loose` affect eligibility thresholds and content-gate behavior together on Latin routes
  - let Hani participate in the same mode scale through eligibility variation even while Hani `contentGate` remains a truthful no-op policy
  - keep `off` scoped to content-gate bypass only
- The implementation must reuse the existing route-aware detector policy model rather than reopening detector architecture.
- In library form, v1 applies to the detector subpath entrypoints that already execute detector policy:
  - `wordCounterWithDetector`
  - `segmentTextByLocaleWithDetector`
  - `countSectionsWithDetector`
  - `inspectTextWithDetector`
- Latin and Hani threshold-coupled mode behavior are now implemented.
- Final docs/release verification is complete.
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
  - allow `default|strict|loose` to affect eligibility thresholds on applicable routes
  - allow Hani to vary by mode through eligibility even if Hani `contentGate` remains `policy = "none"`
  - preserve truthful no-op gate reporting for routes where a prose-style `contentGate` is not meaningfully applied
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
- `strict` tightens policy in two places on routes where `contentGate` is meaningful:
  - it raises eligibility thresholds
  - it tightens content-gate acceptance so more borderline windows fall back
- `loose` relaxes policy in two places on routes where `contentGate` is meaningful:
  - it lowers eligibility thresholds
  - it relaxes content-gate acceptance so more borderline windows may upgrade
- Hani participates in the same public mode set through eligibility, even though Hani does not yet have a prose-style gate policy:
  - `default` keeps the current Hani eligibility threshold
  - `strict` raises the Hani eligibility threshold
  - `loose` lowers the Hani eligibility threshold enough to admit idiom-length samples
  - the initial `loose` calibration target is four Han-bearing characters in the focus window, kept as an internal policy detail rather than a public option
- `off` bypasses `contentGate` evaluation only.
- `off` keeps the same eligibility thresholds as `default`.
- `off` does not disable route eligibility, corroboration, or fallback-tag behavior.
- Eligibility-only routes must accept any supported mode without validation failure.
- Eligibility-only routes must report truthful no-op gate state in diagnostic output:
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

- [x] Extend route-aware detector policy evaluation so `default`, `strict`, and `loose` affect both eligibility and `contentGate` behavior on applicable routes.
- [x] Define fixture-backed behavior differences for `strict` and `loose` on routes where `contentGate` is meaningful, including mode-specific eligibility outcomes.
- [x] Ensure `off` bypasses only `contentGate` evaluation, keeps `default` eligibility thresholds, and leaves corroboration and fallback intact.
- [x] Ensure eligibility-only routes accept the configured mode while remaining truthful no-op gate evaluations.
- [x] Keep policy implementation internal and avoid exposing raw thresholds in the public contract.
- [x] Extend Hani route policy so `default`, `strict`, and `loose` affect Hani eligibility thresholds even while Hani `contentGate` stays `policy = "none"`.
- [x] Calibrate Hani `loose` so idiom-length samples can become eligible without letting borrowed Japanese context create noisy short-window promotions.
- [x] Keep `off` aligned with `default` Hani eligibility thresholds so it remains a gate bypass rather than a detector-lax Hani mode.

Validation for this phase:

- detector-policy tests covering each mode on content-gated routes
- regression tests proving `default|strict|loose` can change eligibility as well as gate evaluation on applicable routes
- regression tests proving `off` changes only gate evaluation, not eligibility or unrelated policy stages
- tests for eligibility-only routes showing accepted config plus `applied = false`
- fixture-backed comparisons demonstrating distinct `default`, `strict`, and `loose` outcomes
- Hani-specific fixtures covering short Han-only samples, idiom-length samples, and borrowed-context mixed Japanese cases

### Phase 3 - Diagnostic And Compatibility Surfaces

- [x] Update inspect output to disclose the configured mode wherever `contentGate` is reported.
- [x] Update debug and detector-evidence payload generation so canonical `contentGate` output reflects the configured mode.
- [x] Preserve `qualityGate` only as the derived compatibility alias in payloads that already expose it.
- [x] Avoid adding `qualityGate` to new inspector-only payloads.
- [x] Ensure eligibility-only routes report the configured mode with honest non-application state.
- [x] Ensure Hani inspect/debug output reports mode-driven eligibility changes truthfully even though Hani `contentGate` remains `policy = "none"`.

Validation for this phase:

- inspect JSON and standard-output tests covering configured-mode disclosure
- legacy debug/evidence regression tests proving `qualityGate` compatibility remains intact
- tests proving new inspector payloads use `contentGate` as the canonical field
- tests for eligibility-only routes showing truthful inspect/debug disclosure
- Hani inspect/debug cases showing `strict|default|loose` threshold differences with `contentGate.applied = false`
- fixture-backed Hani inspect/debug expectations for:
  - `世界` staying ineligible in `default|strict|loose|off`
  - `四字成語` becoming eligible only in `loose`
  - `こんにちは、世界！` staying ineligible unless the Hani focus window itself meets the mode threshold

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
- [x] Add Hani-specific CLI and library regressions for short Han-only windows, idiom-length windows, and borrowed-context mixed Japanese samples across `default|strict|loose|off`.

Validation for this phase:

- `bun test test/command.test.ts`
- detector and library-focused tests for configured-mode behavior
- inspect batch and single-input parity checks
- regression tests proving unchanged behavior outside content-gate policy differences
- Hani-specific regressions proving:
  - `世界` stays ineligible in `default|strict|loose|off`
  - `四字成語` becomes eligible only in `loose`
  - borrowed Japanese context alone does not make `こんにちは、世界！` eligible in `loose`
  - `contentGate.policy` remains `none` for Hani across all modes

### Phase 5 - Docs, Jobs, And Release Readiness

- [x] Update README usage examples for library and CLI `contentGate` configuration.
- [x] Update detector-facing docs and any relevant schema/contract docs to explain configured-mode behavior.
- [x] Record implementation progress in job records under `docs/plans/jobs/`.
- [x] Add release-note-ready documentation of the new public option and compatibility behavior.
- [x] Run final regression, lint, format-check, type-check, and build verification before closing the plan.

Validation for this phase:

- doc review against the settled research contract
- `bun run lint`
- `bun run format:check`
- `bun run type-check`
- `bun run build`
- targeted regression audit across CLI, library, inspect, and compatibility payloads

## Compatibility Gates

- [x] Omitted configuration preserves current `default` behavior.
- [x] `contentGate` remains the canonical diagnostic field.
- [x] `qualityGate` remains available only in legacy payloads that already expose it.
- [x] New inspector-only payloads do not add `qualityGate`.
- [x] `off` disables only gate evaluation and does not disable route eligibility, corroboration, or fallback.
- [x] Eligibility-only routes accept all supported modes without lying about gate application.
- [x] No public numeric threshold controls are introduced in this phase.
- [x] Changed files remain clean under the configured lint and format scripts.
- [x] Hani participates in the documented mode scale rather than remaining fixed at one eligibility threshold.

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
- `docs/plans/jobs/2026-03-25-configurable-content-gate-phase5-docs-and-closure.md`
- `docs/plans/jobs/2026-03-25-configurable-content-gate-phase2-phase4-threshold-mode-implementation.md`
- `docs/plans/jobs/2026-03-25-configurable-content-gate-hani-phase2-phase4-implementation.md`
