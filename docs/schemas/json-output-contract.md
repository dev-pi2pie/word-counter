---
title: "JSON Output Contract"
created-date: 2026-02-17
modified-date: 2026-03-24
status: completed
agent: Codex
---

# JSON Output Contract

This document defines the CLI JSON output contract for `--format json`.
It covers base payload shapes and optional-field behavior for feature flags.

## Scope

- Applies to CLI output only (`word-counter --format json`).
- Applies to single-input runs and batch runs (`--path`) in merged/per-file scopes.
- `--pretty` changes indentation only and does not change payload schema.

## Base Shapes

### Single Input (text, stdin, or one resolved file)

```json
{
  "total": 2,
  "breakdown": {
    "mode": "chunk",
    "items": [{ "locale": "und-Latn", "words": 2 }]
  }
}
```

### Batch Merged (default batch scope)

```json
{
  "total": 4,
  "breakdown": {
    "mode": "chunk",
    "items": [{ "locale": "und-Latn", "words": 4 }]
  }
}
```

### Batch Per-File (`--per-file`)

```json
{
  "scope": "per-file",
  "files": [
    { "path": "/abs/path/a.txt", "result": { "total": 2 } },
    { "path": "/abs/path/b.txt", "result": { "total": 2 } }
  ],
  "aggregate": { "total": 4 }
}
```

## Sectioned Shape (`--section`)

When `--section` is not `all`, each `result` (single, merged, per-file `result`, and per-file `aggregate`) is sectioned:

Supported section modes:
- `split`
- `frontmatter`
- `content`
- `per-key`
- `split-per-key`

```json
{
  "section": "split",
  "frontmatterType": "yaml",
  "total": 7,
  "items": [
    { "name": "frontmatter", "source": "frontmatter", "result": { "total": 3 } },
    { "name": "content", "source": "content", "result": { "total": 4 } }
  ]
}
```

## Optional Feature Mapping

### `--total-of <parts>`

Adds override metadata.

- Single input and batch merged:

```json
{
  "meta": {
    "totalOf": ["words", "emoji"],
    "totalOfOverride": 3
  }
}
```

- Batch per-file:

```json
{
  "scope": "per-file",
  "files": [
    {
      "path": "/abs/path/a.txt",
      "result": { "total": 2 },
      "meta": {
        "totalOf": ["words", "punctuation"],
        "totalOfOverride": 2
      }
    }
  ],
  "aggregate": { "total": 4 },
  "meta": {
    "totalOf": ["words", "punctuation"],
    "aggregateTotalOfOverride": 5
  }
}
```

Compatibility note:
- Top-level `meta.aggregateTotalOfOverride` is retained in per-file payloads.
- Per-file `files[i].meta.totalOfOverride` is additive.

### `--debug` (debug-gated result diagnostics)

Debug-gated result diagnostics use normalized `debug.*` placement.

- Single input and merged batch may include `debug.detector` when detector summaries are available.
- Per-file batch may include:
  - `debug.skipped`
  - `debug.detector`
  - per-entry `files[i].debug.detector`

Per-file compatibility behavior:

- top-level `skipped` is retained temporarily for compatibility
- normalized debug placement is `debug.skipped`

Example:

```json
{
  "scope": "per-file",
  "files": [],
  "debug": {
    "skipped": [{ "path": "/abs/path/x.bin", "reason": "binary content detected" }]
  },
  "skipped": [{ "path": "/abs/path/x.bin", "reason": "binary content detected" }],
  "aggregate": { "total": 0 }
}
```

### `--non-words`, `--include-whitespace`, `--misc`

When non-word collection is enabled, `counts` and non-word breakdown fields are present.
Whitespace details appear when whitespace collection is enabled.

### Detector Debug Summaries (`--debug --detector wasm`)

Detector-aware debug JSON may include `debug.detector` summaries.

Current summary shape:

```json
{
  "debug": {
    "detector": {
      "mode": "wasm",
      "engine": "whatlang-wasm",
      "windowsTotal": 1,
      "accepted": 1,
      "fallback": 0
    }
  }
}
```

Per-file batch entries may also carry per-file detector summaries:

```json
{
  "scope": "per-file",
  "files": [
    {
      "path": "/abs/path/a.txt",
      "result": { "total": 13 },
      "debug": {
        "detector": {
          "mode": "wasm",
          "engine": "whatlang-wasm",
          "windowsTotal": 1,
          "accepted": 1,
          "fallback": 0
        }
      }
    }
  ]
}
```

Notes:

- Detector debug summaries are debug-gated and additive.
- Default non-debug JSON remains result-oriented.
- Stable `meta.detector` metadata remains reserved for future additive contract work.

## Contract Rules

- `scope` is present only for per-file batch payloads.
- `files` is present only for per-file batch payloads.
- `aggregate` is present only for per-file batch payloads.
- `meta` is optional and appears only when feature-specific metadata exists.
- `debug` is optional and appears only when debug-gated diagnostics exist.
- `skipped` is optional and debug-gated in per-file batch payloads as a compatibility legacy field.

## Version History

- After `v0.1.5-canary.2`:
  - added normalized debug-gated JSON diagnostics under `debug.*`
  - added `debug.detector` summaries for detector-aware debug JSON
  - added per-entry `files[i].debug.detector` in per-file batch JSON
  - retained top-level `skipped` temporarily for compatibility while adding `debug.skipped`
- `v0.1.5-canary.2` and earlier:
  - per-file debug JSON used top-level `skipped` only
  - no normalized `debug.*` contract was documented

## Related Docs

- `README.md`
- `docs/schemas/default-config.md`
- `docs/schemas/whitespace-categories.md`
