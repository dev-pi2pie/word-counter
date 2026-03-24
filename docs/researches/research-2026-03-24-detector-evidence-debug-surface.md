---
title: "detector evidence debug surface"
created-date: 2026-03-24
modified-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Define a user-facing diagnostics surface for `--detector wasm` that exposes detector judgment evidence, including raw engine confidence and reliability values, without overloading detector mode semantics or destabilizing the normal output contract.

## Key Findings

- This should not be a new detector mode.
  - `regex` vs `wasm` is an execution choice.
  - evidence and explanation are observability concerns, not detector-engine selection concerns.
- This should not become a second independent debug system.
  - keep one shared debug pipeline
  - add detector evidence as a higher-detail detector route within that existing pipeline
- A separate option is the cleaner contract surface.
  - recommended flag: `--detector-evidence`
  - acceptable alternates considered: `--detector-trace`, `--explain-detector`
  - rejected direction: engine-specific names such as `wasm-...` because they overfit the current backend and age poorly if another detector engine is added later
- The first version should be debug-stream first, not a new primary output mode.
  - recommended contract: `--detector-evidence` requires `--debug`
  - evidence should flow through the existing structured debug event stream and optional debug report JSONL sink
  - normal result JSON should remain small and result-oriented
- The existing observability model already gives the right layering:
  - `debug.detector` in result JSON for small summaries
  - JSONL/debug event stream for full evidence records

## Debug Route Model

Model this as one debug system with two detector detail levels:

- standard debug route:
  - runtime, path, batch, and current detector summary events
- detector-evidence route:
  - an additional detector-specific high-detail surface layered on top of the same debug stream

Recommended flag combinations:

- no `--debug`
  - no debug events
  - no detector evidence
- `--debug`
  - standard compact events
  - compact detector summary only
- `--debug --verbose`
  - standard verbose events
  - detector window decision events
- `--debug --detector wasm --detector-evidence`
  - standard debug events
  - compact detector evidence events with bounded previews
- `--debug --verbose --detector wasm --detector-evidence`
  - standard verbose events
  - full-fidelity detector evidence events

## Recommended CLI Direction

- Keep `--detector wasm` as the engine selector.
- Add `--detector-evidence` as an additional diagnostics flag.
- First-version scope:
  - meaningful only with `--detector wasm`
  - requires `--debug`
  - allowed with terminal debug output or `--debug-report`
- Suggested behavior:
  - without `--detector-evidence`, keep current compact/verbose detector events
  - with `--detector-evidence`, include deeper per-window evidence records in the debug stream

## Recommended Output Direction

### 1. Runtime Evidence Records

Use the existing debug event-stream contract for full detector evidence.

Recommended event name:

- `detector.window.evidence`

Recommended event fields:

- envelope fields from the shared debug event contract
- path/file context when applicable
- `engine`
- `routeTag`
- `windowIndex`
- in compact evidence mode:
  - `textPreview`
  - `textPreviewTruncated`
  - `normalizedPreview`
  - `normalizedPreviewTruncated`
- in verbose evidence mode:
  - full raw `text`
  - full normalized `normalizedText`
- eligibility result
- quality-gate result
- raw Whatlang values:
  - `lang`
  - `script`
  - `confidence`
  - `reliable`
  - remapped public tag
- normalized-sample Whatlang values:
  - `lang`
  - `script`
  - `confidence`
  - `reliable`
  - remapped public tag
- final decision:
  - accepted vs fallback
  - acceptance path
  - final public tag
  - fallback reason

Illustrative shape:

```json
{
  "schemaVersion": 1,
  "timestamp": "2026-03-24T05:32:21.123Z",
  "runId": "wc-debug-1774330341123-55149",
  "topic": "detector",
  "scope": "file",
  "event": "detector.window.evidence",
  "verbosity": "compact",
  "path": "docs/example.md",
  "engine": "whatlang-wasm",
  "routeTag": "und-Latn",
  "windowIndex": 0,
  "textPreview": "Hello world from alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu",
  "textPreviewTruncated": true,
  "normalizedPreview": "Hello world from alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu",
  "normalizedPreviewTruncated": false,
  "eligible": true,
  "qualityGate": true,
  "raw": {
    "lang": "eng",
    "script": "Latin",
    "confidence": 0.93,
    "reliable": true,
    "remappedTag": "en"
  },
  "normalized": {
    "lang": "eng",
    "script": "Latin",
    "confidence": 0.91,
    "reliable": true,
    "remappedTag": "en"
  },
  "decision": {
    "accepted": true,
    "path": "reliable",
    "finalTag": "en",
    "fallbackReason": null
  }
}
```

### 2. Result JSON Summary

Keep result JSON small and additive.

- continue using `debug.detector` for compact summaries
- do not place full evidence records into normal result JSON in the first version

Illustrative summary:

```json
{
  "debug": {
    "detector": {
      "mode": "wasm",
      "engine": "whatlang-wasm",
      "windowsTotal": 3,
      "accepted": 2,
      "fallback": 1
    }
  }
}
```

## Counting Mode Interaction

Counting mode should not change the granularity of detector evidence.

Recommended rule:

- detector evidence is emitted for detector windows
- not for final output-mode rows
- not for per-character units
- not for collector aggregates

Reason:

- WASM detection evaluates solid ambiguous windows before result rendering
- output mode only changes how already-resolved chunks are counted and displayed afterward

Implications by mode:

- `chunk`
  - result shows chunk breakdown
  - evidence still shows detector windows
- `segments`
  - result shows segments
  - evidence still shows detector windows
- `collector`
  - result aggregates by locale
  - evidence still shows detector windows
- `char`
  - result counts grapheme clusters
  - evidence still shows detector windows
- `char-collector`
  - result aggregates character totals by locale
  - evidence still shows detector windows

Recommended metadata fields for evidence records:

- `mode`
- `section`
- `path` when batch execution is used
- optional section context when `--section` is active

Those fields provide context only and should not change detector evidence granularity.

## Verbosity Behavior

`--detector-evidence` should still require `--debug`, and evidence detail should follow verbosity.

Recommended first-version behavior:

- `--debug --detector wasm --detector-evidence`
  - emit detector evidence with bounded previews
  - keep the evidence payload practical for terminal output and compact report inspection
- `--debug --verbose --detector wasm --detector-evidence`
  - emit full raw text windows
  - emit full normalized samples
  - preserve the rest of the verbose detector evidence payload

This keeps one consistent rule:

- non-verbose evidence is bounded
- verbose evidence is full-fidelity

Selected first-version text rules:

- bounded preview size should be `160` Unicode code points per field
  - apply the bound independently to raw preview text and normalized preview text
- truncation should be signaled with explicit metadata fields, not suffix markers embedded in the preview string
  - recommended field names: `textPreviewTruncated` and `normalizedPreviewTruncated`
- non-verbose multiline previews should collapse line breaks and repeated whitespace to single spaces before truncation
  - reason: compact evidence should stay single-line and dense in terminal/debug-report inspection
- terminal and report-file output can share the same event shape; verbosity controls the amount of text carried in that shape

## Debug Report Filename Direction

If `--detector-evidence` is enabled together with `--debug-report` and no explicit path is provided, use a distinct autogenerated filename so evidence-heavy reports are visually distinguishable from ordinary debug reports.

Recommended default pattern:

- `wc-detector-evidence-YYYYMMDD-HHmmss-utc-<pid>.jsonl`

Reason:

- keeps the shared debug pipeline intact
- makes evidence-focused runs easier to find and archive separately
- avoids mixing the higher-volume evidence surface into the default `wc-debug-...` report naming contract without a clear signal

Compatibility note:

- this should apply only to evidence-enabled autogenerated report names
- ordinary `--debug-report` without `--detector-evidence` should keep the existing `wc-debug-YYYYMMDD-HHmmss-utc-<pid>.jsonl` pattern

## Why This Direction

- Reusing the current debug stream avoids adding another one-off output mode.
- It fits the repository-wide observability model already implemented.
- It keeps normal CLI output stable.
- It gives advanced users exactly the evidence they want:
  - raw engine confidence
  - raw engine reliability
  - normalized-sample comparison
  - final acceptance or fallback reason

## Resolved Decisions

- `--detector-evidence` requires `--debug`.
- Evidence detail follows verbosity:
  - without `--verbose`: bounded previews
  - with `--verbose`: full raw text windows and full normalized samples
- The compact preview contract for the first version is:
  - at most `160` Unicode code points for each preview field
  - truncation signaled with explicit boolean metadata fields
  - multiline preview content collapsed to single-line whitespace
- The distinct autogenerated evidence filename should be included in the first implementation:
  - `wc-detector-evidence-YYYYMMDD-HHmmss-utc-<pid>.jsonl`
- A standalone explain-style output mode is deferred until debug-stream-first usage proves insufficient.

## Implications or Recommendations

- If this moves to implementation, create a new plan rather than extending the now-completed debug observability plan.
- Keep the first implementation narrow:
  - `--detector-evidence`
  - `--detector wasm`
  - `--debug` required
  - JSONL/debug-stream first
- Do not introduce a new detector mode for this capability.

## Related Research

- `docs/researches/research-2026-03-24-global-debug-observability-model.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`

## Related Plans

- `docs/plans/plan-2026-03-24-detector-evidence-debug-implementation.md`
