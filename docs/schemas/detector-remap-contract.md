---
title: "Detector Remap Contract (Draft)"
created-date: 2026-03-23
modified-date: 2026-03-25
status: draft
agent: Codex
---

# Detector Remap Contract (Draft)

This document defines how detector-engine output is remapped into the public locale tags exposed by `word-counter`.

## Scope

- Applies to detector-enabled flows only.
- Current first engine is `whatlang` behind `--detector wasm`.
- Default regex/script detection remains unchanged and is out of scope for this remap contract except where fallback returns to `und-*`.

## Detector Mode Model

- `regex`
  - default mode
  - uses current Unicode script and hint logic only
- `wasm`
  - optional detector-assisted mode
  - currently planned around `whatlang`

## Route Gating

The detector only runs for ambiguous script routes.

- `und-Latn`
  - minimum script-bearing characters: `24`
- `und-Hani`
  - minimum script-bearing characters: `12`

Script-bearing characters mean characters in the relevant script only.
For `und-Hani`, detector-only borrowed adjacent Japanese context may also contribute `Hiragana` and `Katakana` characters to the eligibility count.
Whitespace, punctuation, symbols, and digits do not count toward the threshold.

If a chunk is below the threshold, it stays on the original `und-*` route.

## Confidence and Reliability Policy

- The detector result must satisfy both:
  - confidence threshold for the route
  - reliability requirement for the route
- Current draft thresholds:
  - `und-Latn`: confidence `>= 0.75` and `reliable = true`
  - `und-Hani`: confidence `>= 0.90` and `reliable = true`
- Current Latin corroboration rule:
  - if the raw detector sample and the normalized script-bearing detector sample agree on the same remapped Latin tag, accept at confidence `>= 0.70`
  - this corroboration path exists to improve noisy markdown-like Latin text without broadly lowering the default Latin threshold

If the detector result does not satisfy the route policy, the result falls back to the original ambiguous `und-*` tag.

## `whatlang` Input/Output Normalization

`whatlang` returns ISO 639-3 language identifiers plus script, confidence, and reliability signals.
Those values are not emitted directly as the public package contract.

The public output must use this package's own locale-tag contract instead.

## Route-Specific Remap Rules

### `und-Latn`

Allowed remaps:

| `whatlang` ISO 639-3 | Public tag |
| --- | --- |
| `eng` | `en` |
| `fra` | `fr` |
| `deu` | `de` |
| `spa` | `es` |
| `por` | `pt` |
| `ita` | `it` |
| `nld` | `nl` |
| `pol` | `pl` |
| `tur` | `tr` |
| `ron` | `ro` |
| `hun` | `hu` |
| `ces` | `cs` |
| `dan` | `da` |
| `swe` | `sv` |
| `fin` | `fi` |
| `cat` | `ca` |
| `lat` | `la` |

Rules:

- The detector result must report `Latin` script.
- Unsupported languages fall back to `und-Latn`.

### `und-Hani`

Allowed remaps:

| `whatlang` ISO 639-3 | Public tag |
| --- | --- |
| `cmn` | `zh` |
| `jpn` | `ja` |

Rules:

- `cmn` must report `Mandarin` script from `whatlang`.
- `jpn` may report `Mandarin`, `Hiragana`, or `Katakana`.
- Do not auto-emit `zh-Hans` or `zh-Hant`.
- Unsupported languages fall back to `und-Hani`.

## Fallback Rules

Return to the original ambiguous `und-*` tag when any of the following is true:

- chunk length is below the route threshold
- the detector returns no result
- the detector script does not match the route
- the detected language is not in the route allow-list
- confidence is below threshold
- reliability is false

## Provenance Metadata

Detector-assisted output should reserve room for provenance metadata in JSON output.

Draft source values:

- `script`
- `hint`
- `wasm`

Defined draft placement:

- top-level `meta.detector.mode`
- top-level `meta.detector.provenance = "per-item"`
- chunk-style detector-assisted items may include `source`

This document defines the allowed provenance values and remap behavior.
The broader JSON contract is documented in `docs/schemas/json-output-contract.md`.

## Related Docs

- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
- `docs/schemas/json-output-contract.md`
