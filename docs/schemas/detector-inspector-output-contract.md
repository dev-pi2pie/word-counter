---
title: "Detector Inspector Output Contract"
created-date: 2026-03-25
status: draft
agent: Codex
---

# Detector Inspector Output Contract

This document defines the planned first-version request/response contract for `word-counter inspect` and the matching detector-subpath inspector API.

## Scope

- Applies to inspect-only detector diagnostics.
- Covers `pipeline` and `engine` views.
- Covers `standard` and `json` output modes.
- `--pretty` changes JSON indentation only and does not change payload schema.
- Is independent from the counting-flow debug event stream.

## Top-Level Container

Single-input JSON inspector results use one shared top-level container.

Required fields:

- `schemaVersion`
- `kind`
- `view`
- `detector`
- `input`

First-version values:

- `schemaVersion: 1`
- `kind: "detector-inspect"`
- `view: "engine" | "pipeline"`
- `detector: "wasm" | "regex"`

## Input Object

Required fields:

- `sourceType`
- `textLength`
- `textPreview`
- `textPreviewTruncated`

Optional fields:

- `path`
  - present only when the inspect input came from `--path <file>`

Allowed `sourceType` values:

- `inline`
- `path`

Preview rules:

- use a `160` Unicode code point preview cap
- collapse repeated whitespace to a single space for preview fields
- carry truncation state as explicit booleans instead of string suffix markers

## Validation Boundaries

Current CLI shape:

```bash
word-counter inspect [--detector wasm|regex] [--view pipeline|engine] [--format standard|json] [--pretty] [--section all|frontmatter|content] [--path-mode auto|manual] [--no-recursive] [--include-ext <exts>] [--exclude-ext <exts>] [--regex <pattern>] [-p|--path <path> ...] [text...]
```

Shared validation rules:

- `--view engine` requires `--detector wasm`
- `--detector regex` is valid only with `--view pipeline`
- `--format raw` is invalid for `inspect`
- `--pretty` changes JSON indentation only
- positional inspect input is always treated as text, never auto-resolved as a path
- supported inspect section modes are:
  - `all`
  - `frontmatter`
  - `content`
- counting-oriented inspect section modes remain invalid:
  - `split`
  - `per-key`
  - `split-per-key`

Single-input rules:

- exactly one input source is allowed:
  - positional text
  - one direct `--path <file>`
- both positional text and `--path`:
  - `` `inspect` accepts either positional text or --path inputs, not both. ``
- no input:
  - `No inspect input provided. Pass text or use --path.`
- empty or whitespace-only input returns a valid empty inspect result instead of a usage error

Batch/path rules:

- repeated `-p, --path` values enable inspect batch mode
- default `--path-mode` is `auto`
- in `--path-mode auto`, directory inputs are expanded using the same path-resolution contract as counting
- in `--path-mode manual`, `--path` values are treated as literal file inputs and explicit directories become `not a regular file` failures
- directory-expanded files honor:
  - `--no-recursive`
  - `--include-ext`
  - `--exclude-ext`
  - `--regex`

Batch output rules:

- batch JSON uses a dedicated container with:
  - `summary`
  - `files`
  - `skipped`
  - `failures`
- batch standard output uses:
  - a batch header
  - per-file inspect blocks
  - `Skipped` / `Failures` sections

Batch exit rules:

- non-zero when any `failures` entry is present
- non-zero when `files` is empty after path resolution/filtering, even if `failures` is empty
- `0` when `files` is non-empty and `failures` is empty, even if `skipped` entries are present

## Engine View

`engine` view is WASM-only and reports engine-centered detector output without package-level projection.

Required fields:

- `routeTag`
- `sample`
- `engine`

`sample` fields:

- `text`
- `textLength`
- `normalizedText`
- `normalizedApplied`
- `textSource`
- optional `borrowedContext`

Allowed `textSource` values:

- `focus`
- `borrowed-context`

`engine` fields:

- `name`
- `raw`
- optional `normalized`
- `remapped`

Example:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect",
  "view": "engine",
  "detector": "wasm",
  "input": {
    "sourceType": "inline",
    "textLength": 18,
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

## Pipeline View

`pipeline` view reports package-centered detector behavior.

Top-level fields:

- `chunks`
- `resolvedChunks`
- optional `windows`
- optional `decision`

WASM pipeline windows include:

- `windowIndex`
- `routeTag`
- `chunkRange`
- `focusTextPreview`
- `focusTextPreviewTruncated`
- `diagnosticSample`
- `eligibility`
- `contentGate`
- `engine`
- `decision`

Regex pipeline output:

- requires `chunks`
- requires `resolvedChunks`
- requires a top-level deterministic `decision`
- must not emit placeholder `windows`, `engine`, `eligibility`, or `contentGate`

Regex chunk `source` values:

- `script`
- `hint`
- `fallback`

Chunk `reason` remains optional explanatory text.

Example WASM pipeline shape:

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
        "scriptChars": 14,
        "minScriptChars": 12,
        "passed": true
      },
      "contentGate": {
        "applied": false,
        "passed": true,
        "policy": "none"
      },
      "engine": {
        "executed": true
      },
      "decision": {
        "accepted": true,
        "path": "reliable",
        "finalTag": "ja",
        "fallbackReason": null
      }
    }
  ],
  "resolvedChunks": [
    {
      "index": 0,
      "locale": "ja",
      "textPreview": "こんにちは、世界！これはテストです。",
      "textPreviewTruncated": false
    }
  ]
}
```

## Empty Results

Empty inspect results remain valid and explicit.

Shared empty-result rules:

- keep the standard top-level container
- use `decision.kind = "empty"`
- keep empty arrays instead of omitting `chunks`, `windows`, or `resolvedChunks` where that view normally includes them

Empty engine view:

- omit `routeTag`
- omit `engine`
- keep an empty `sample` payload

Empty pipeline view:

- `chunks: []`
- `resolvedChunks: []`
- `windows: []` for WASM pipeline

## Standard Output Expectations

First-version standard output is section-based and bounded.

Recommended order:

1. title block
2. input summary
3. chunk summary
4. per-window details
5. resolved chunk summary

Formatting rules:

- use stable section labels
- keep previews single-line and bounded to the same `160` code point limit
- reserve full exact sampled text for engine-view JSON only

## Version History

- Draft for `v0.1.5-canary.4` follow-up planning:
  - establishes the first dedicated inspector schema track
  - separates inspector evolution from the counting debug-event stream

## Related Docs

- `docs/schemas/debug-event-stream-contract.md`
- `docs/schemas/detector-remap-contract.md`
- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
