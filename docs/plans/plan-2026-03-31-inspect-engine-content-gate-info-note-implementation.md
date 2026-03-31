---
title: "inspect engine content gate info note implementation"
created-date: 2026-03-31
status: draft
agent: Codex
---

## Goal

Implement the settled `inspect --view engine` UX refinement so `--content-gate ...` keeps its current raw-engine behavior while the CLI emits a cyan informational note that directs users to `--view pipeline` for eligibility and content-gate restriction diagnosis.

## Context

- The current `engine` view is intentionally raw and reports the diagnostic sample plus Whatlang output without package-level projection.
- The current `pipeline` view is where `eligibility`, `contentGate`, acceptance, and fallback decisions are evaluated and disclosed.
- The CLI currently accepts `--content-gate ...` together with `--view engine`, but that flag does not change engine output.
- The new research settles that the UX gap should be solved with an informational note rather than with validation rejection or engine-view policy semantics.

## Scope

- In scope:
  - add an inspect-local informational note for `--view engine` combined with a meaningful content-gate setting
  - keep the note styled as cyan/info rather than warning/error output
  - define the exact trigger rules for explicit CLI, config, and env-derived content-gate settings
  - update inspect help and docs so engine vs pipeline responsibilities are explicit
  - add regression coverage for note emission and non-emission cases
- Out of scope:
  - changing `engine` view payloads or output fields
  - applying `contentGate` policy inside `engine` view
  - rejecting `--content-gate` together with `--view engine`
  - changing detector thresholds, route policy behavior, or window selection
  - broader inspect UX redesign unrelated to this note

## Decisions Settled for This Plan

- `--view engine` remains a raw engine/sample/remap surface.
- `--content-gate` remains accepted syntax under `inspect --view engine`.
- The CLI should emit a cyan info note when:
  - the user explicitly passes `--content-gate ...`, including `default`
  - the effective inspect content-gate mode comes from config or env and resolves to a non-default value
- The CLI should not emit the note for ordinary engine-view runs that simply inherit the default content-gate mode with no explicit or effective override.
- The note should be emitted once per inspect invocation, before single-input or batch rendering begins, so batch runs do not repeat the same message per file.
- The note should explain both facts:
  - `--content-gate` does not affect engine-view output
  - `--view pipeline` is the correct inspect surface for eligibility and content-gate restriction diagnosis
- The implementation should stay inspect-local rather than introducing a broader shared CLI notice abstraction unless a concrete duplication need appears during coding.

## Phase Task Items

### Phase 1 - Effective-Mode Note Emission

- [ ] Identify the inspect command point where config/env application has already resolved the effective detector and content-gate values.
- [ ] Add inspect-local logic that emits the cyan info note before execution when:
  - `view === "engine"`
  - `detector === "wasm"`
  - the note trigger rules are satisfied
- [ ] Keep the note out of the main inspect result body so standard and JSON result payloads remain unchanged.
- [ ] Ensure the note is emitted to stderr rather than being mixed into stdout result output.
- [ ] Ensure the note is emitted once per inspect invocation, including batch runs, rather than once per inspected file.

Validation for this phase:

- command tests for explicit CLI `--content-gate default|strict|loose|off` with `--view engine`
- command tests proving explicit `--content-gate default` emits the note while inherited default content-gate does not
- command tests for config/env-derived non-default content-gate modes with `--view engine`
- command tests proving ordinary default engine runs do not emit the note
- command tests proving batch engine runs emit the note once per invocation, not once per file

### Phase 2 - Docs And Help Alignment

- [ ] Update inspect help text to clarify that `--content-gate` affects pipeline policy inspection, not raw engine view.
- [ ] Update `README.md` inspect guidance so engine vs pipeline responsibilities are explicit at the user-facing command level.
- [ ] Update `docs/schemas/detector-inspector-output-contract.md` to note that engine view ignores content-gate policy and that the CLI may emit an informational note for that combination.
- [ ] Keep the wording aligned with the settled research message and cyan/info intent.

Validation for this phase:

- docs review against the settled research note
- spot-check command examples so the docs do not imply engine-view gate enforcement

### Phase 3 - Regression And Contract Audit

- [ ] Confirm that engine-view stdout output remains unchanged for the same input before and after the note feature.
- [ ] Confirm that inspect JSON output remains schema-identical and free of note text.
- [ ] Confirm that pipeline-view behavior, counting behavior, and detector-subpath inspect library results remain unchanged.

Validation for this phase:

- targeted `test/command-inspect.test.ts` coverage for stdout/stderr separation
- targeted regression checks for JSON output stability
- targeted detector inspect tests if implementation touches shared inspect execution code

## Compatibility Gates

- [ ] `inspect --view engine` continues to return the same detector result data for the same text.
- [ ] The new informational note does not alter stdout payloads for either `standard` or `json` output.
- [ ] `inspect --view pipeline` remains the only inspect view that exposes `eligibility`, `contentGate`, and fallback reasoning.
- [ ] Existing config/env/CLI precedence for effective content-gate mode remains unchanged.

## Related Research

- `docs/researches/research-2026-03-31-inspect-engine-content-gate-info-note.md`
- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-03-25-configurable-content-gate-behavior.md`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/plans/plan-2026-03-26-config-content-gate-support.md`
