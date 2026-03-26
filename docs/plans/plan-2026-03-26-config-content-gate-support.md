---
title: "config content gate support"
created-date: 2026-03-26
modified-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Extend the config layer so detector policy mode becomes configurable alongside detector selection, with one explicit precedence model across config files, environment variables, and CLI flags for both counting and `inspect`.

## Context

- The completed config-file support plan added config-backed detector selection, path settings, reporting, logging, and totals.
- The current config layer still omits detector policy mode even though `--content-gate default|strict|loose|off` is already a public CLI and detector-policy surface.
- The updated config research now treats that omission as a gap in the first-version contract rather than an optional follow-up.
- The implementation should stay aligned with the existing detector-policy work rather than reopening detector semantics.

## Scope

- In scope:
  - add root config support for `contentGate.mode`
  - add inspect-specific config support for `inspect.contentGate.mode`
  - add environment-variable support for `WORD_COUNTER_CONTENT_GATE`
  - wire config/env/CLI precedence for content-gate mode into both counting and inspect command flows
  - ensure `inspect` inherits the root content-gate mode when `inspect.contentGate.mode` is absent
  - ensure `inspect --content-gate ...` remains invocation-scoped
  - update schema, guide, README, and example config files
  - add precedence and inheritance regression coverage
- Out of scope:
  - numeric threshold configuration
  - route-specific public detector-policy tuning beyond the existing mode set
  - changing `contentGate` semantics for Latin or Hani routes
  - detector-subpath API redesign

## Decisions Settled For This Plan

- The supported config values are:
  - `contentGate.mode = "default" | "strict" | "loose" | "off"`
  - `inspect.contentGate.mode = "default" | "strict" | "loose" | "off"`
- `contentGate.mode` is the root detector-policy default for counting flows.
- `inspect.contentGate.mode` is an optional inspect-only override.
- If `inspect.contentGate.mode` is omitted, `inspect` inherits the root `contentGate.mode`.
- `WORD_COUNTER_CONTENT_GATE` overrides config-derived content-gate defaults.
- CLI `--content-gate ...` overrides both env and config values.
- `inspect --content-gate ...` overrides the effective inspect content-gate mode for that invocation only; it does not rewrite the root content-gate setting.

## Phase Task Items

### Phase 1 - Contract And Plumbing

- [x] Add `contentGate.mode` and `inspect.contentGate.mode` to the config schema types and normalization layer.
- [x] Add `WORD_COUNTER_CONTENT_GATE` to env-backed config resolution.
- [x] Update merged config application for counting and inspect so content-gate mode follows the same precedence rules as detector mode.
- [x] Keep inspect inheritance explicit: root fallback first, inspect override second, CLI override last.

Validation for this phase:

- targeted config parsing tests for root and inspect content-gate shapes
- env resolution tests for `WORD_COUNTER_CONTENT_GATE`
- precedence tests for config -> env -> CLI overrides

### Phase 2 - Runtime Integration And Validation

- [x] Thread config-derived content-gate mode into counting command execution.
- [x] Thread config-derived content-gate mode into inspect command execution.
- [x] Preserve current validation behavior for unsupported content-gate values and detector/view combinations.
- [x] Ensure omitted config keeps the current effective default of `default`.

Validation for this phase:

- CLI tests for count-mode config-driven `contentGate`
- CLI tests for inspect root inheritance and inspect-only override
- regression tests proving explicit `--content-gate` still wins over config and env

### Phase 3 - Docs And Examples

- [x] Update `docs/schemas/default-config.md` for the new config keys and mapping rules.
- [x] Update `docs/config-usage-guide.md` for root and inspect content-gate configuration.
- [x] Update `README.md` examples and config notes.
- [x] Update `examples/wc-config/` so the example files reflect the final documented default contract or explicitly documented content-gate defaults.

Validation for this phase:

- docs review against the updated research contract
- example config tests proving all supported formats parse and behave consistently

## Compatibility Gates

- [x] Omitted config still preserves the current effective content-gate default of `default`.
- [x] Existing CLI `--content-gate` behavior remains unchanged and keeps highest precedence.
- [x] Existing detector-mode precedence remains unchanged while adding content-gate precedence alongside it.
- [x] `inspect.contentGate.mode` only affects inspect behavior and does not silently rewrite root counting behavior.

## Related Research

- `docs/researches/research-2026-03-26-config-layer-and-detector-defaults.md`
- `docs/researches/research-2026-03-25-configurable-content-gate-behavior.md`

## Related Plans

- `docs/plans/plan-2026-03-26-config-file-support-and-detector-defaults.md`
- `docs/plans/plan-2026-03-25-configurable-content-gate-behavior.md`
