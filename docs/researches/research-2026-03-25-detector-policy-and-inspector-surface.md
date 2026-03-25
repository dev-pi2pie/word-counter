---
title: "detector policy and inspector surface"
created-date: 2026-03-25
status: draft
agent: codex
---

## Goal

Define a clearer detector architecture for three follow-up needs:

- replacing hardcoded detector policy branches with a route-aware policy model
- improving `und-Hani` handling for mixed Japanese and Han text in WASM mode
- adding an inspect-only detector surface for CLI and library users

## Key Findings

- The current `qualityGate` concept is narrower than the public debug shape suggests.
  - In `src/detector/policy.ts`, the gate is a Latin-only prose-vs-technical classifier.
  - In `src/detector/wasm.ts`, non-Latin routes bypass that logic and effectively report `qualityGate = true`.
  - As a result, the current debug field looks like a generic detector judgment even though it is only meaningful for `und-Latn`.
- The current policy model mixes several different decisions into one inline flow:
  - route eligibility by script-bearing character count
  - sample normalization
  - Latin-only content gating
  - acceptance by confidence and reliability
  - Latin-only corroborated acceptance
  - fallback tag resolution
- The mixed Japanese and Han failure case is driven more by window construction than by raw Whatlang output.
  - Base segmentation currently stops Japanese Han carry across punctuation and newline boundaries.
  - That behavior is intentional in `src/wc/segment.ts` and is covered by tests.
  - A sample such as `こんにちは、世界！これはテストです。` therefore produces an isolated `und-Hani` chunk for `世界！`.
  - That isolated chunk is too small to clear current `und-Hani` detector eligibility and falls back before the WASM path sees enough Japanese context.
- Changing the base segmentation contract first would be riskier than changing detector-only context building.
  - Existing tests intentionally assert that Japanese carry should stop across punctuation and newline boundaries.
  - A detector-only solution can preserve current regex/script chunk behavior while still improving WASM diagnosis for ambiguous Han windows.
- The `@dev-pi2pie/word-counter/detector` subpath is counting-oriented, not inspection-oriented.
  - The public surface exposes async counting and segmentation entrypoints.
  - Advanced `detectorDebug` usage exists as an option shape, but there is no first-class public helper for collecting summaries or window diagnostics.
  - This makes callback-based library usage possible but not especially discoverable or stable-looking.
- The current CLI already supports pipeline-level detector diagnostics.
  - `--debug --detector wasm --detector-evidence` can inspect direct text or file content via `--path`.
  - That surface explains the current pipeline decision, not just the raw WASM engine result.
- A true inspector surface still needs a separate contract.
  - The raw WASM runtime takes both text and route context.
  - Users may want either:
    - raw engine diagnosis
    - full pipeline diagnosis with windowing, normalization, acceptance, and fallback

## Implications or Recommendations

- Do not expose the current `qualityGate` boolean as the main customization surface.
  - That would freeze a misleading abstraction.
  - The real public or internal model should separate:
    - eligibility policy
    - content policy
    - acceptance policy
    - fallback policy
- Introduce a route-aware detector policy abstraction before adding new user-facing knobs.
  - First version should stay internal to avoid prematurely locking threshold details into the package API.
  - A reasonable target shape is:

```ts
type DetectorRoutePolicy = {
  eligibility: { minScriptChars: number };
  normalizeSample(text: string): string;
  buildDiagnosticContext?(window: DetectorWindow, chunks: LocaleChunk[]): string;
  contentGate?(windowText: string, normalizedText: string): boolean;
  accept(candidate: DetectorResult): boolean;
  acceptCorroborated?(raw: DetectorResult, normalized: DetectorResult): boolean;
  fallbackTag(window: DetectorWindow, options: DetectorLocaleOptions): string;
};
```

- Treat `und-Hani` mixed Japanese handling as a detector-context problem.
  - Keep the current resolution span as the ambiguous `und-Hani` chunk range.
  - Allow the WASM diagnostic sample for `und-Hani` to borrow adjacent `ja` chunks under a conservative rule.
  - Apply the accepted locale only back onto the ambiguous span so detector improvements do not require rewriting the base chunking contract.
- Keep the Hani context rule conservative in the first version.
  - Prefer borrowing adjacent Japanese context only when the ambiguous Han span is directly adjacent to `ja` chunks with no competing script-bearing chunk in between.
  - This reduces the risk of pulling unrelated Chinese Han text into Japanese diagnosis.
- Add a first-class inspect-only surface instead of pushing more responsibility onto `detectorDebug`.
  - Recommended library direction:
    - add an async inspector entrypoint under the detector subpath
    - return structured diagnostics as data instead of requiring callback capture
  - Recommended CLI direction:
    - add an `inspect` subcommand that prints detector diagnostics without the normal count result
    - support both direct text and `--path` inputs for markdown and plain text files
- Keep two inspection levels distinct.
  - raw engine inspection should report direct Whatlang output with minimal remapping
  - pipeline inspection should report chunk/window construction, normalization, acceptance path, and fallback
- Keep the inspector additive relative to the existing debug-stream contract.
  - `--debug --detector wasm --detector-evidence` remains the canonical runtime debug-stream surface for counting flows.
  - The inspector should not replace that debug stream.
  - Instead, it should provide:
    - a stable request/response library API for programmatic diagnosis
    - a print-only CLI surface for users who want detector diagnosis without count output
  - The canonical payload families should be:
    - debug event stream for runtime counting diagnostics
    - inspector result objects for direct raw and pipeline diagnosis
  - Pipeline inspector payloads may reuse the same internal evidence-building logic as the debug stream, but they should be emitted as normal data objects rather than event envelopes.
- Keep the inspect command aligned with the current CLI naming model.
  - The recommended command shape is `word-counter inspect ...`, not `inspector`.
  - A verb-style command aligns better with the existing `doctor` subcommand.
  - The command should keep detector engine, inspection layer, and output format as separate dimensions:
    - `--detector wasm|regex`
    - `--view pipeline|engine`
    - `--format standard|json`
- Keep inspect output formats narrower than counting formats.
  - The inspect command should support:
    - `--format standard`
    - `--format json`
  - The inspect command should not support `--format raw` in the first version.
  - In counting mode, `raw` means scalar output; inspector output has no equivalent single-number contract.
- Default inspect behavior should optimize for explaining package behavior.
  - Recommended defaults:
    - `--detector wasm`
    - `--view pipeline`
    - `--format standard`
  - `pipeline` is the better default because it remains useful even when the engine does not execute due to ineligibility or fallback.
- Support regex inspection only at the pipeline layer in the first version.
  - `--detector wasm --view engine` is valid.
  - `--detector wasm --view pipeline` is valid.
  - `--detector regex --view pipeline` is valid.
  - `--detector regex --view engine` should be rejected because regex does not expose an engine-native confidence/reliability judgment layer.
- Define `--view` as the inspection-layer selector, not as a detector selector.
  - `engine` means:
    - show what the detector engine returned for the sampled text
    - include route tag, sampled text, raw engine values, and remapped public tags
    - do not include full package acceptance/fallback projection
  - `pipeline` means:
    - show how the package built chunks and windows
    - show borrowed context and normalization when applicable
    - show content gate result
    - show engine execution or skip reason
    - show acceptance path or fallback reason
    - show final locale projection back onto the resolved chunks
- If `detectorDebug` remains part of the public option types, export a stable helper surface for it.
  - Export the debug context and summary types from the detector subpath.
  - Export a helper for creating a summary collector if summary emission remains supported in library code.
- Strengthen detector subpath documentation and type coverage.
  - README should document:
    - when to use the root package vs `./detector`
    - that detector entrypoints are async
    - what `detectorDebug` is for
    - what the proposed inspector API is for
  - Type tests should cover the published detector subpath, not only the root package.

## Proposed Research-to-Plan Scope

The next implementation plan should stay focused on architecture and diagnostics, not on broad threshold retuning.

Recommended scope:

- refactor inline WASM decision logic into route-aware detector policy objects
- add detector-only context expansion for `und-Hani` windows in mixed Japanese cases
- add inspect-only detector surfaces for CLI and library usage
- add `docs/schemas/detector-inspector-output-contract.md` as the inspector result contract
- update detector subpath docs and published type coverage

Recommended non-goals for that plan:

- replacing the base regex/script segmentation contract
- exposing many low-level threshold flags in the CLI
- broad retuning of Latin thresholds unless the refactor reveals a concrete regression

## Recommended Resolution of Open Questions

- `und-Hani` context expansion should require at least one directly adjacent `ja` chunk, not Japanese context on both sides.
  - Requiring both sides would miss the most common shape of the reported problem, where an ambiguous Han span appears at one edge of a Japanese sentence fragment.
  - The first version should borrow up to one adjacent `ja` chunk from the left and up to one adjacent `ja` chunk from the right when present.
  - When both sides are present, both should be included by default in text order: left `ja` context, ambiguous `und-Hani` span, right `ja` context.
  - When only one side is present, borrow only that side.
  - The borrowed context should be used only for detector diagnosis.
  - The accepted locale should still be projected back only onto the original ambiguous `und-Hani` span.
  - Borrowing should stop when a non-whitespace chunk with a different script-bearing locale sits between the ambiguous span and the candidate `ja` chunk.
  - Concrete acceptance examples for the first version:
    - `こんにちは、世界！これはテストです。`
      - base chunk shape remains `ja` + `und-Hani` + `ja`
      - borrowed detector sample should include all three chunks
      - if the detector accepts Japanese, only the original `世界！` span is relabeled to `ja`
    - `こんにちは、世界！`
      - base chunk shape remains `ja` + `und-Hani`
      - borrowed detector sample should include the left `ja` chunk plus the ambiguous span
      - if the detector does not accept Japanese, the final tag remains `und-Hani`
    - `こんにちは Hello 世界`
      - the Latin chunk blocks adjacency between `ja` and `und-Hani`
      - no Japanese borrowing should occur across the Latin chunk
- The debug field named `qualityGate` should be replaced by a broader `contentGate` structure, while preserving `qualityGate` only as a temporary compatibility alias in existing debug/evidence payloads.
  - The current name implies a generic detector judgment even though it only applies to the Latin prose gate today.
  - The cleaner contract is:
    - `contentGate.applied`
    - `contentGate.passed`
    - `contentGate.policy`
  - First-version policy values should be:
    - `latinProse` for the current Latin prose-vs-technical rule
    - `none` when no route-specific content gate is applied
  - Emission rules should be:
    - keep `qualityGate` only in existing debug/evidence event payloads that already expose it today
    - do not add `qualityGate` to new library inspector payloads
    - do not add `qualityGate` to normalized result JSON summaries
  - During the compatibility window, `qualityGate` should be emitted only as a derived alias for `contentGate.passed`.
  - The alias should be documented as deprecated immediately once `contentGate` lands.
  - The alias should be removed in the next debug schema version bump, with the expected cutoff being `schemaVersion: 2`.
  - New library inspector output should use only `contentGate`.
- Raw inspector output should expose internal Whatlang `lang` and `script` values directly, together with remapped public tags.
  - The point of a raw inspector is diagnosis, not abstraction.
  - Hiding engine-native values would make it harder to understand remap failures and script mismatches.
  - The recommended raw shape should include:
    - route tag
    - sampled text
    - raw engine `lang`
    - raw engine `script`
    - confidence
    - reliability
    - remapped public tag, when supported
  - Pipeline inspection should then build on top of that raw payload by adding normalization, windowing, acceptance path, and fallback outcome.
- The inspect-only CLI should be a new subcommand, not an additional top-level counting mode.
  - A subcommand keeps result contracts separate from normal counting output.
  - A subcommand also avoids awkward validation rules between inspection-only output and existing counting flags such as `--mode`, `--section`, and `--total-of`.
  - The recommended first-version direction is `word-counter inspect ...`, with output modes tailored for diagnostics rather than counting summaries.

## Recommended Inspect Command Contract

Recommended first-version CLI shape:

```bash
word-counter inspect [--detector wasm|regex] [--view pipeline|engine] [--format standard|json] <text-or-path>
```

Recommended defaults:

- `--detector wasm`
- `--view pipeline`
- `--format standard`

Recommended validation rules:

- `--view engine` requires `--detector wasm`
- `--detector regex` is supported only with `--view pipeline`
- `--format raw` is invalid under `inspect`

Recommended semantics:

- `--view engine`
  - detector-engine-centered diagnosis
  - for WASM only in the first version
  - suitable for understanding raw Whatlang output and remap behavior
- `--view pipeline`
  - package-behavior-centered diagnosis
  - supported for both `wasm` and `regex`
  - suitable for understanding chunking, windowing, normalization, gating, and final locale projection

Recommended regex pipeline payload direction:

- show final chunk order and locale assignment
- show source or reason such as:
  - script detection
  - Latin hint rule
  - explicit Latin hint
  - Han fallback after boundary
- do not imitate WASM confidence or reliability fields where none exist

## Recommended Inspector Schema Direction

The implementation plan should include a dedicated schema task item for:

- `docs/schemas/detector-inspector-output-contract.md`

Recommended scope of that schema doc:

- define the top-level inspector container
- define `engine` view output
- define `pipeline` view output
- define detector-specific validation boundaries such as:
  - `regex` supports `pipeline` only
  - `wasm` supports `engine` and `pipeline`
- define format expectations for:
  - `standard` as human-readable text
  - `json` as structured tool-facing output
- record version history independently from the debug-event-stream schema so inspector evolution does not force unrelated debug schema churn

## Residual Open Questions

- The exact field-level JSON schema for `engine` and `pipeline` inspector output still needs implementation-level design, but the payload boundary and field direction above are now settled.
- The exact standard-format text layout for `inspect` still needs implementation-level design, but the command, view model, and format boundaries above are now settled.

## Related Plans

- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`
- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`
- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`

## Related Research

- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-03-24-detector-evidence-debug-surface.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
