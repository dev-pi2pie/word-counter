---
title: "detector policy refactor and inspect command"
created-date: 2026-03-25
modified-date: 2026-03-25
status: active
agent: Codex
---

## Goal

Implement a route-aware detector policy layer and the first-version `inspect` surface so detector diagnostics become a stable, explicit contract for both CLI and detector-subpath users without changing the existing counting-oriented debug stream.

## Context

- The research for detector policy and inspector behavior is now specific enough to implement without opening broader detector customization.
- The current inline WASM decision path mixes eligibility, normalization, content gating, acceptance, corroboration, and fallback decisions in one flow.
- The next implementation needs to:
  - refactor that logic into route-aware policy objects
  - keep the first version focused on the settled `inspect` contract
  - preserve the existing counting flow and debug-event stream as separate compatibility surfaces
- The research also settles that first-version `inspect` remains single-input only and does not expand into batch, directory, or broader section-oriented diagnostics.

## Scope

- In scope:
  - refactor inline WASM detector decision logic into route-aware detector policy objects
  - add detector-only Japanese context borrowing for `und-Hani` diagnostic samples under the conservative adjacency rule settled in research
  - introduce the first-version `inspect` command and detector-subpath inspector entrypoint
  - support `--view pipeline|engine`
  - support `--format standard|json`
  - support `--detector wasm|regex` with regex limited to `pipeline`
  - define and implement the single-input-only inspect contract for positional text or one `--path <file>`
  - add `docs/schemas/detector-inspector-output-contract.md`
  - update detector subpath docs and published type coverage for the inspector surface
  - introduce `contentGate` across the new detector-policy and inspector code paths, including counting/debug/evidence payload generation where that detector state is exposed
  - preserve compatibility for existing debug/evidence consumers with a temporary `qualityGate` alias derived from `contentGate.passed`
- Out of scope:
  - configurable content-gate strength, modes, or user-facing policy knobs
  - inspect batch mode
  - inspect directory mode
  - expansion of `--section` beyond what is already explicitly settled in the research document
  - replacing the existing regex/script segmentation contract
  - broad detector-threshold retuning unless the refactor exposes a concrete regression that blocks the settled scope

## Decisions Settled for This Plan

- The detector refactor stays internal-first.
  - Route-aware policy objects become the implementation boundary, not a new public configuration surface.
- The first policy split must separate:
  - route eligibility
  - sample normalization
  - optional diagnostic-context borrowing
  - content gate evaluation
  - acceptance and corroborated acceptance
  - fallback tag selection
- `und-Hani` mixed Japanese handling is solved at the detector-sample layer, not by changing base chunk segmentation.
  - Borrow up to one directly adjacent `ja` chunk on the left and up to one directly adjacent `ja` chunk on the right.
  - Borrowing stops when a non-whitespace chunk with a competing script-bearing locale intervenes.
  - Accepted detector output still projects only onto the original ambiguous `und-Hani` span.
- `contentGate` becomes the structured detector-state contract in all new code paths that expose detector gate results.
  - New inspector payloads expose `contentGate` only.
  - Existing counting/debug/evidence payloads that already expose `qualityGate` emit `contentGate` alongside the temporary `qualityGate` alias during the compatibility window.
- The detector subpath remains additive in this phase.
  - Existing public detector entrypoints stay exported:
    - `segmentTextByLocaleWithDetector`
    - `wordCounterWithDetector`
    - `countSectionsWithDetector`
  - Existing detector option types and `detectorDebug`-related types/helpers stay public in this phase and are not replaced by `inspect`.
  - The new detector-subpath inspector contract added in this plan is:
    - `inspectTextWithDetector`
    - `DetectorInspectOptions`
    - `DetectorInspectView`
    - `DetectorInspectResult`
    - inspector result/supporting types required by the schema contract
- The first CLI contract is:

```bash
word-counter inspect [--detector wasm|regex] [--view pipeline|engine] [--format standard|json] [--path <file>] [text...]
```

- First-version inspect defaults remain:
  - `--detector wasm`
  - `--view pipeline`
  - `--format standard`
- First-version inspect validation remains narrow:
  - `--view engine` requires `--detector wasm`
  - `--detector regex` is valid only with `--view pipeline`
  - `--format raw` is invalid for `inspect`
  - exactly one input source is allowed
  - positional input is always treated as text, never auto-resolved as a path
- Empty or whitespace-only input returns a valid empty inspect result, not a usage error.
- The inspector remains additive.
  - `--debug --detector wasm --detector-evidence` stays the canonical counting-flow runtime diagnostics surface.
  - `inspect` provides a separate request/response contract for direct diagnosis.

## Phase Task Items

### Phase 1 - Detector Policy Extraction

- [x] Introduce a route-aware detector policy abstraction under `src/detector/` that isolates:
  - route eligibility thresholds
  - sample normalization
  - optional diagnostic-context borrowing
  - content gate evaluation
  - acceptance and corroborated acceptance
  - fallback tag selection
- [x] Refactor the current WASM decision path to use those policy objects instead of inline branching.
- [x] Replace new internal `qualityGate`-style decisions with a structured `contentGate` result and thread that structure through all new detector-state outputs.
- [x] Emit `contentGate` anywhere new counting/debug/evidence payload generation surfaces detector gate state, while retaining `qualityGate` only as a temporary compatibility alias for existing debug/evidence consumers.
- [x] Add focused unit coverage for policy behavior on at least:
  - `und-Latn` content-gated windows
  - `und-Hani` windows that remain ineligible
  - accepted vs fallback WASM decisions
  - existing debug/evidence payloads that expose both `contentGate` and the temporary `qualityGate` alias during the compatibility window

Validation for this phase:

- `bun test test/detector-interop.test.ts`
- targeted tests proving the same counting output is preserved for non-inspect flows under unchanged inputs
- targeted regressions proving existing debug/evidence consumers receive `contentGate` alongside the temporary `qualityGate` alias

### Phase 2 - Hani Diagnostic Context and Inspector Data Model

- [x] Implement conservative adjacent-`ja` context borrowing for `und-Hani` diagnostic samples without changing base chunk segmentation output.
- [x] Keep detector projection scoped to the original ambiguous span even when borrowed context is used for diagnosis.
- [x] Add the shared inspector result container and detector-specific data types for:
  - `engine` view
  - WASM `pipeline` view
  - regex `pipeline` view
  - empty inspect results
- [x] Add `docs/schemas/detector-inspector-output-contract.md` with:
  - top-level container rules
  - `engine` and `pipeline` JSON shapes
  - detector/view validation boundaries
  - standard-vs-JSON output expectations
  - version-history notes independent from the debug-event-stream schema

Validation for this phase:

- regression samples covering:
  - `こんにちは、世界！これはテストです。`
  - `こんにちは、世界！`
  - `こんにちは Hello 世界`
- schema examples stay aligned with the settled preview, truncation, and empty-result rules from research

### Phase 3 - Library Inspector Surface and Detector Subpath Coverage

- [ ] Add `inspectTextWithDetector` as a first-class async detector-subpath entrypoint that returns structured data instead of requiring `detectorDebug` callback capture.
- [ ] Add and export the settled inspector types needed for the detector-subpath contract:
  - `DetectorInspectOptions`
  - `DetectorInspectView`
  - `DetectorInspectResult`
  - inspector result/supporting types required by the schema contract
- [ ] Keep existing `detectorDebug` types/helpers public and documented as additive runtime-debug helpers rather than replacing them in this phase.
- [ ] Update package export/type coverage so the detector subpath is verified as a published surface, not only the root package.
- [ ] Update detector-subpath documentation to explain:
  - when to use the root package vs `./detector`
  - that detector entrypoints are async
  - how `detectorDebug` differs from the new inspector entrypoint
  - that inspector output is for direct diagnostics, not counting results

Validation for this phase:

- package-surface type tests covering detector-subpath importability and the new inspector types
- at least one library-focused test proving inspector output is returned as structured data without debug callback plumbing
- detector-subpath contract tests proving the existing exports remain available alongside the new inspector exports

### Phase 4 - CLI Inspect Command and Input Validation

- [ ] Add the `inspect` subcommand without coupling it to counting-mode flags such as `--mode`, `--section`, or `--total-of`.
- [ ] Implement first-version option support for:
  - `--view pipeline|engine`
  - `--format standard|json`
  - `--detector wasm|regex`
  - positional text input
  - one `--path <file>` input
- [ ] Enforce the settled validation rules for:
  - missing input
  - mixed positional text plus `--path`
  - directory paths
  - unreadable files
  - unsupported detector/view combinations
  - unsupported `--format raw`
- [ ] Ensure regex inspection is limited to `pipeline` and uses the deterministic chunk/source/reason contract settled in research.
- [ ] Ensure engine view is WASM-only and surfaces engine-native values plus remapped public tags without pipeline projection.
- [ ] Implement standard-format output with stable section labels and bounded previews that match the schema guidance.
- [ ] Implement JSON output for both supported inspect views so the CLI contract matches the schema contract and detector/view validation rules.

Validation for this phase:

- `bun test test/command.test.ts`
- CLI coverage for:
  - default `inspect` behavior
  - `--view engine`
  - `--detector regex --view pipeline`
  - `inspect --format json`
  - successful `inspect --path <file>` execution
  - invalid `--detector regex --view engine`
  - empty input results
  - empty or whitespace-only `inspect --path <file>` results
  - each single-input contract failure path

### Phase 5 - Compatibility Closure, Docs, and Regression Audit

- [ ] Recheck that existing counting flows, detector evidence, and debug JSON remain additive-only relative to the new inspector work.
- [ ] Update README or detector-facing usage docs where the new inspect command and detector-subpath inspector need discoverability.
- [ ] Add or update job records under `docs/plans/jobs/` when implementation phases land.
- [ ] Run a regression audit across CLI, library, and published type surfaces before closing the plan.

Validation for this phase:

- `bun run type-check`
- `bun run build`
- targeted CLI and library regression checks covering unchanged counting output alongside new inspect behavior

## Compatibility Gates

- [x] Default counting behavior remains unchanged when `inspect` is not used.
- [ ] Existing `--debug --detector wasm --detector-evidence` behavior remains the canonical runtime debug surface for counting flows.
- [x] The base regex/script chunk segmentation contract remains unchanged in this plan.
- [ ] `qualityGate` is not added to new inspector payloads.
- [x] Existing counting/debug/evidence payloads that currently expose gate state gain `contentGate` without losing the temporary `qualityGate` compatibility alias during this phase.
- [ ] `inspect` remains single-input only in this phase and fails clearly instead of partially supporting batch or directory inputs.
- [ ] `inspect` does not introduce `raw` output semantics or new `--section` behavior in this phase.
- [ ] Regex inspection does not imitate WASM confidence/reliability fields where no engine-native equivalent exists.

## Validation

- `bun test test/detector-interop.test.ts`
- `bun test test/command.test.ts`
- published-surface and type coverage checks for the detector subpath
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`
- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`
- `docs/plans/plan-2026-03-24-detector-evidence-debug-implementation.md`
- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-03-24-detector-evidence-debug-surface.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`

## Related Jobs

- `docs/plans/jobs/2026-03-25-detector-policy-phase1-phase2-implementation.md`
