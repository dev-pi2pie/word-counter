---
title: "configurable content gate behavior"
created-date: 2026-03-25
modified-date: 2026-03-25
status: draft
agent: codex
---

## Goal

Determine whether the detector `contentGate` should become user-configurable after the current detector-policy and inspect work, and if so, define the safest product surface for that configuration.

## Key Findings

- The current detector-policy work intentionally keeps `contentGate` internal-first.
  - The recent detector-policy and inspect research settled the architectural split from `qualityGate` to `contentGate`.
  - That work did not settle any user-facing strictness controls.
- Exposing `contentGate` too early would freeze semantics that are still route-asymmetric.
  - `und-Latn` currently has the meaningful content-gate policy.
  - `und-Hani` currently uses `contentGate` mostly as a structured “not applied” state.
  - A single global user control would therefore affect Latin behavior much more than Han behavior in the current design.
- Inspect output should exist first before policy-strength controls are exposed.
  - Without the `inspect` command and inspector schema in place, users cannot easily understand what stricter or looser policy actually changed.
  - Inspect output will provide the observability needed to make policy controls explainable and testable.
- The likely user stories are real, but they are different enough that a single loose knob may be misleading.
  - Some users will want stricter fallback to avoid false positives on technical prose.
  - Some users will want looser acceptance for prose-heavy mixed content.
  - Some users may want to bypass the gate completely for experimentation.
- A global on/off control is much easier to document than a route-specific tuning matrix, but it may still be too coarse.
  - If exposed, the first version should likely be a small discrete mode set rather than numeric thresholds.
  - Numeric threshold controls would leak internal policy mechanics and be harder to keep stable across releases.

## Implications or Recommendations

- Do not fold configurable `contentGate` behavior into the current detector-policy/inspect implementation plan.
  - It is a separate product/API decision.
  - It depends on having the new inspect tooling available first.
- Research this as a separate follow-up track after the first inspect prototype is implemented.
- Prefer discrete policy modes over low-level threshold exposure if any user-facing control is added.
- The recommended first public surface, if the follow-up implementation ever proceeds, is:
  - available in both CLI and library forms
  - global for all applicable routes
  - based on one small mode set:
    - `default`
    - `strict`
    - `loose`
    - `off`
- Treat `off` as a potentially sharp tool.
  - It should be researched carefully before exposure because it can deliberately increase wrong-but-confident detector upgrades.
- Make inspect output the primary explanation surface for any future gate control.
  - If a mode changes acceptance behavior, inspect output should show the applied policy mode and resulting `contentGate` evaluation.

## Recommended First-Version Candidate Contract

If configurable `contentGate` behavior is implemented in a later phase, the recommended v1 contract is:

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

Recommended v1 scope rules:

- expose the same mode set in CLI and library forms
- keep the mode global, not route-specific
- non-applicable routes must not reject the configured mode
- non-applicable routes must no-op the configured mode for decision behavior
- non-applicable routes must disclose that no-op state in inspect/debug output with `contentGate.applied = false` and `contentGate.policy = "none"`
- on routes where `contentGate` is meaningful:
  - apply the configured mode normally
  - current expectation: mostly Latin-gated detector routes
- on routes where `contentGate` is not meaningful:
  - never reject the configured mode as invalid
  - always treat the configured mode as a no-op for decision behavior
  - keep inspect/debug disclosure truthful by reporting the configured mode while `contentGate.applied = false` and `contentGate.policy = "none"`
- do not expose low-level thresholds or route-specific tuning in v1

## Recommended Mode Semantics

The follow-up implementation plan should use these semantics unless later evidence forces a change:

| Mode | Meaning | Expected bias |
| --- | --- | --- |
| `default` | current project policy | balanced against the existing fixture-backed contract |
| `strict` | tighten acceptance so more borderline windows fall back | safer against false positives |
| `loose` | relax acceptance so more borderline windows may upgrade | more permissive for prose-heavy mixed input |
| `off` | bypass `contentGate` evaluation only | leaves other detector-policy rules intact |

Additional first-version rules:

- `off` disables only `contentGate`
  - it does not disable route eligibility rules
  - it does not disable corroboration rules
  - it does not disable fallback-tag behavior
- `strict` and `loose` should be defined by fixture-backed behavior, not numeric thresholds in the public contract
- inspect output should disclose the active policy mode whenever it affects decision reporting

## Remaining Research Questions

- Should `contentGate` be configurable at all, or should the project keep detector policy fixed and fixture-backed?
- What exact fixture-backed behavior table should define `strict` and `loose`?
- Should mode disclosure appear in both `engine` and `pipeline` inspect output, or only where package policy is actually applied?
- Should the configuration surface live under detector options directly, or under the dedicated nested `contentGate` object shown above?

## Recommended Future Research Scope

The follow-up research should include:

- user-story framing for why a configurable gate is needed
- comparison of CLI and library ergonomics
- fixture-backed behavior tables for candidate modes
- compatibility impact assessment
- inspect/debug disclosure expectations for active policy mode

The follow-up research should stay out of:

- broad detector engine selection work
- inspect batch mode
- changes to the base regex/script segmentation contract

## Recommended Timing

- finish the current detector-policy and inspect implementation first
- let the single-input inspect prototype stabilize
- then open the follow-up implementation plan for configurable `contentGate` behavior if the inspect prototype reveals a clear user need

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-03-24-detector-evidence-debug-surface.md`
