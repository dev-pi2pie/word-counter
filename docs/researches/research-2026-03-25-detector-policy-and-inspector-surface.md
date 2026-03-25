---
title: "detector policy and inspector surface"
created-date: 2026-03-25
modified-date: 2026-03-25
status: completed
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
type ContentGateResult = {
  applied: boolean;
  passed: boolean;
  policy: "latinProse" | "none";
};

type DetectorRoutePolicy = {
  eligibility: { minScriptChars: number };
  normalizeSample(text: string): string;
  buildDiagnosticContext?(window: DetectorWindow, chunks: LocaleChunk[]): string;
  evaluateContentGate?(windowText: string, normalizedText: string): ContentGateResult;
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
    - support positional text input and `--path <file>` input for markdown and plain text files
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
    - positional text input or `--path <file>`
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
  - `contentGate` should be one structured result shape everywhere it appears in new code paths.
    - For Latin windows:
      - `applied: true`
      - `policy: "latinProse"`
      - `passed` reflects the prose-vs-technical evaluation
    - For non-Latin windows:
      - `applied: false`
      - `policy: "none"`
      - `passed: true`
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
word-counter inspect [--detector wasm|regex] [--view pipeline|engine] [--format standard|json] [--path <file>] [text...]
```

Recommended defaults:

- `--detector wasm`
- `--view pipeline`
- `--format standard`

Recommended validation rules:

- `--view engine` requires `--detector wasm`
- `--detector regex` is supported only with `--view pipeline`
- `--format raw` is invalid under `inspect`
- exactly one input source is allowed:
  - positional text input
  - one `--path <file>`
- directory expansion is out of scope for `inspect` in the first version
- positional input must always be treated as text, never auto-interpreted as a path
- `inspect` does not support batch or directory inspection in the first version
  - unsupported batch-oriented usage should fail with a clear error instead of degrading into partial behavior

Recommended first-version input failure rules:

- when neither positional text nor `--path` is provided:
  - error with: `No inspect input provided. Pass text or use --path <file>.`
- when both positional text and `--path` are provided:
  - error with: `` `inspect` accepts either positional text or one `--path <file>`, not both. ``
- when `--path` points to a directory:
  - error with: `` `inspect --path` requires a regular file. ``
- when `--path` points to an unreadable file:
  - error with the same top-level shape used by normal counting input failures:
    - `Failed to read input: <underlying message>`
- when the resolved input is empty or whitespace-only:
  - return a valid empty inspect result rather than treating it as a usage error

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
- use a fixed chunk contract:
  - `source` is required and categorical
  - `reason` is optional and explanatory

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

## Recommended First-Version Inspector Payload Shapes

The first schema version should use one shared top-level container for all inspector JSON output.

Recommended preview policy:

- use a `160` Unicode code point preview limit for inspector JSON preview fields
- align this limit with the existing detector evidence preview limit for consistency
- use preview fields plus explicit truncation metadata in JSON structures that can repeat many times, such as:
  - top-level `chunks`
  - top-level `resolvedChunks`
  - per-window focus and diagnostic sample summaries
- reserve full exact sampled text for the engine-view `sample.text` field only
  - reason: engine inspection is the one view where exact sampled content is most important
  - even there, include `sample.textLength` so consumers can reason about payload size

Recommended shared container fields:

- `schemaVersion`
- `kind`
- `view`
- `detector`
- `input`

Recommended first-version shared field values:

- `schemaVersion: 1`
- `kind: "detector-inspect"`
- `view: "engine" | "pipeline"`
- `detector: "wasm" | "regex"`

Recommended `input` object fields:

- `sourceType`
  - `inline`
  - `path`
- `path`
  - present only for path-based input
- `textLength`
- `textPreview`
  - bounded preview for compact JSON output
- `textPreviewTruncated`

Recommended `engine` view JSON shape:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect",
  "view": "engine",
  "detector": "wasm",
  "input": {
    "sourceType": "inline",
    "textLength": 28,
    "textPreview": "Hello world sample",
    "textPreviewTruncated": false
  },
  "routeTag": "und-Latn",
  "sample": {
    "text": "Hello world sample",
    "textLength": 18,
    "normalizedText": "Hello world sample",
    "normalizedApplied": false,
    "textSource": "focus"
  },
  "engine": {
    "name": "whatlang-wasm",
    "raw": {
      "lang": "eng",
      "script": "Latin",
      "confidence": 0.99,
      "reliable": true
    },
    "normalized": {
      "lang": "eng",
      "script": "Latin",
      "confidence": 0.99,
      "reliable": true
    },
    "remapped": {
      "rawTag": "en",
      "normalizedTag": "en"
    }
  }
}
```

Recommended `engine` view field rules:

- include `routeTag`
- include the exact sampled text under `sample.text`
- include `sample.textLength`
- include `sample.normalizedText` and `sample.normalizedApplied`
- include `sample.textSource` with these first-version values:
  - `focus`
  - `borrowed-context`
- include `sample.borrowedContext` only when context borrowing occurred
- include raw engine-native values directly
- include remapped public tags separately
- omit package-level `decision` and resolved chunks from `engine` view

Recommended sample-assembly rules:

- `focusText` always means the original ambiguous route span only
- `sample.text` always means the exact text sent to the detector engine
- when no context borrowing occurs:
  - `sample.text` and `focusText` refer to the same span
- when context borrowing occurs:
  - `sample.text` is assembled in text order as:
    - optional borrowed left context
    - focus span
    - optional borrowed right context
  - `sample.textLength` measures the full assembled `sample.text`
- normalization always runs after the final sampled text is assembled
  - build borrowed context first when applicable
  - then run route-specific normalization across the full `sample.text`
- because normalization is route-specific, a borrowed-context sample may collapse back to only the ambiguous script-bearing focus in the normalized output
  - example:
    - borrowed sample text: `こんにちは、世界！これはテストです。`
    - Hani-normalized output: `世界`

Recommended `pipeline` view JSON shape:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect",
  "view": "pipeline",
  "detector": "wasm",
  "input": {
    "sourceType": "inline",
    "textLength": 19,
    "textPreview": "こんにちは、世界！これはテストです。",
    "textPreviewTruncated": false
  },
  "chunks": [
    {
      "index": 0,
      "locale": "ja",
      "textPreview": "こんにちは、",
      "textPreviewTruncated": false,
      "source": "script"
    },
    {
      "index": 1,
      "locale": "und-Hani",
      "textPreview": "世界！",
      "textPreviewTruncated": false,
      "source": "script"
    },
    {
      "index": 2,
      "locale": "ja",
      "textPreview": "これはテストです。",
      "textPreviewTruncated": false,
      "source": "script"
    }
  ],
  "windows": [
    {
      "windowIndex": 0,
      "routeTag": "und-Hani",
      "chunkRange": {
        "start": 1,
        "end": 1
      },
      "focusTextPreview": "世界！",
      "focusTextPreviewTruncated": false,
      "diagnosticSample": {
        "textPreview": "こんにちは、世界！これはテストです。",
        "textPreviewTruncated": false,
        "normalizedTextPreview": "世界",
        "normalizedTextPreviewTruncated": false,
        "normalizedApplied": true,
        "borrowedContext": {
          "leftChunkIndex": 0,
          "rightChunkIndex": 2
        }
      },
      "eligibility": {
        "scriptChars": 2,
        "minScriptChars": 12,
        "passed": false
      },
      "contentGate": {
        "applied": false,
        "passed": true,
        "policy": "none"
      },
      "engine": {
        "executed": false,
        "reason": "notEligible"
      },
      "decision": {
        "accepted": false,
        "path": null,
        "fallbackReason": "notEligible",
        "finalTag": "und-Hani"
      }
    }
  ],
  "resolvedChunks": [
    {
      "index": 0,
      "locale": "ja",
      "textPreview": "こんにちは、",
      "textPreviewTruncated": false
    },
    {
      "index": 1,
      "locale": "und-Hani",
      "textPreview": "世界！",
      "textPreviewTruncated": false
    },
    {
      "index": 2,
      "locale": "ja",
      "textPreview": "これはテストです。",
      "textPreviewTruncated": false
    }
  ]
}
```

Recommended `pipeline` view field rules:

- always include initial `chunks`
- include `windows` for detector-mode routing analysis
- include `resolvedChunks` as the final post-decision chunk projection
- in `pipeline` view, top-level `chunks` and `resolvedChunks` should carry `textPreview` plus truncation metadata, not full text
- each window should expose:
  - `routeTag`
  - `chunkRange`
  - focus text preview
  - diagnostic sample preview and normalized sample preview
  - eligibility result
  - `contentGate`
  - engine execution result or skip reason
  - final decision
- regex pipeline output should reuse the same top-level container and `chunks` / `resolvedChunks` structure, but:
  - omit `windows`
  - omit `eligibility`
  - omit `contentGate`
  - omit `engine`
  - use deterministic chunk-level `source` and `reason` fields instead
  - still include a top-level `decision` summary that explains the deterministic route outcome

Recommended `regex` pipeline JSON shape:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect",
  "view": "pipeline",
  "detector": "regex",
  "input": {
    "sourceType": "inline",
    "textLength": 19,
    "textPreview": "こんにちは、世界！これはテストです。",
    "textPreviewTruncated": false
  },
  "chunks": [
    {
      "index": 0,
      "locale": "ja",
      "textPreview": "こんにちは、",
      "textPreviewTruncated": false,
      "source": "script",
      "reason": "hiragana-katakana"
    },
    {
      "index": 1,
      "locale": "und-Hani",
      "textPreview": "世界！",
      "textPreviewTruncated": false,
      "source": "script",
      "reason": "han-fallback-after-boundary"
    },
    {
      "index": 2,
      "locale": "ja",
      "textPreview": "これはテストです。",
      "textPreviewTruncated": false,
      "source": "script",
      "reason": "hiragana-katakana"
    }
  ],
  "decision": {
    "kind": "deterministic",
    "notes": [
      "Regex inspection does not use detector windows or engine confidence.",
      "Final locales come directly from script detection, hint rules, and fallback rules."
    ]
  },
  "resolvedChunks": [
    {
      "index": 0,
      "locale": "ja",
      "textPreview": "こんにちは、",
      "textPreviewTruncated": false
    },
    {
      "index": 1,
      "locale": "und-Hani",
      "textPreview": "世界！",
      "textPreviewTruncated": false
    },
    {
      "index": 2,
      "locale": "ja",
      "textPreview": "これはテストです。",
      "textPreviewTruncated": false
    }
  ]
}
```

Recommended `regex` pipeline field rules:

- require `chunks`
- require `resolvedChunks`
- require a top-level deterministic `decision` object
- require chunk-level `source`
- allow chunk-level `reason`
- do not emit placeholder `engine`, `windows`, `eligibility`, or `contentGate` fields for regex pipeline output

Recommended regex pipeline chunk field contract:

- `source` is required with these first-version values:
  - `script`
  - `hint`
  - `fallback`
- `reason` is optional freeform explanatory text for human-facing precision such as:
  - `hiragana-katakana`
  - `han-fallback-after-boundary`
  - `latin-hint-rule`
  - `explicit-latin-hint`
- top-level regex pipeline output should always include exactly these major objects:
  - `input`
  - `chunks`
  - `decision`
  - `resolvedChunks`
- top-level regex pipeline output should never include:
  - `windows`
  - `engine`
  - `eligibility`
  - `contentGate`

## Recommended Empty Inspect Results

Whitespace-only or empty input should return a valid inspect result instead of a usage error.

Recommended empty `pipeline` result shape:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect",
  "view": "pipeline",
  "detector": "wasm",
  "input": {
    "sourceType": "inline",
    "textLength": 0,
    "textPreview": "",
    "textPreviewTruncated": false
  },
  "chunks": [],
  "windows": [],
  "decision": {
    "kind": "empty",
    "notes": [
      "No detector-eligible content was present."
    ]
  },
  "resolvedChunks": []
}
```

Recommended empty `engine` result shape:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect",
  "view": "engine",
  "detector": "wasm",
  "input": {
    "sourceType": "inline",
    "textLength": 0,
    "textPreview": "",
    "textPreviewTruncated": false
  },
  "sample": {
    "text": "",
    "textLength": 0,
    "normalizedText": "",
    "normalizedApplied": false,
    "textSource": "focus"
  },
  "decision": {
    "kind": "empty",
    "notes": [
      "No detector-eligible content was present."
    ]
  }
}
```

Recommended empty-result rules:

- empty `pipeline` output should use empty arrays for `chunks`, `windows`, and `resolvedChunks`
- empty `engine` output should omit `routeTag` and `engine`
- both empty-result views should include a lightweight `decision.kind = "empty"` marker
- empty-result handling should be shared across inline text and `--path` file input
- empty regex `pipeline` output should follow the regex-specific top-level shape:
  - include `input`
  - include `chunks: []`
  - include `decision.kind = "empty"`
  - include `resolvedChunks: []`
  - omit `windows`, `engine`, `eligibility`, and `contentGate`

## Recommended First-Version Standard Output Layout

The first standard-format layout should be compact, deterministic, and section-based.

Recommended top-level layout:

1. title block
2. input summary
3. chunk summary
4. per-window details
5. resolved chunk summary

Recommended title block fields:

- `Detector inspect`
- `View: <engine|pipeline>`
- `Detector: <wasm|regex>`

Recommended input summary fields:

- source type
- optional path
- text length

Recommended chunk summary layout:

- numbered rows
- locale
- short text preview
- source or reason when available

Recommended per-window layout for `pipeline`:

- `Window <n>`
- route tag
- chunk range
- focus text preview
- borrowed context summary when present
- normalized-sample summary
- eligibility result
- content gate result
- engine execution or skip line
- decision line

Recommended `engine` view layout:

- sampled text block
- normalized-sample block
- raw engine result block
- normalized engine result block when present
- remap result line

Recommended first-version text conventions:

- use stable section labels so examples and tests remain easy to maintain
- keep previews single-line by collapsing repeated whitespace
- use the same `160` Unicode code point preview limit in standard output
- use bounded previews in standard output rather than full multi-line payload dumps
- reserve exact full sampled text for engine-view JSON only

## Remaining Narrow Design Items

- The exact allowance for repeated `--path` values in a future inspect batch mode, if any, is intentionally out of scope for the first version.

## Related Plans

- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`
- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`
- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`

## Related Research

- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-03-24-detector-evidence-debug-surface.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
