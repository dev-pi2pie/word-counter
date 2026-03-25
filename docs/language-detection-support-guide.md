---
title: "Language Detection Support Guide"
created-date: 2026-03-25
modified-date: 2026-03-25
status: active
agent: Codex
---

# Language Detection Support Guide

## Goal

Document the current language-detection routes, the currently supported public tags, and the remap process used by the optional WASM detector path.

## Current Routes

`word-counter` currently has two language-detection routes.

### 1. `regex` route

- Default route.
- Uses Unicode script checks plus built-in and user-provided hint rules.
- Does not use a statistical language-ID engine.
- Produces deterministic script or hint-based locale assignment at chunking time.

Current direct script outputs:

- `ja`
  - `Hiragana`
  - `Katakana`
- `ko`
  - `Hangul`
- `ar`
  - `Arabic`
- `ru`
  - `Cyrillic`
- `hi`
  - `Devanagari`
- `th`
  - `Thai`

Current ambiguous-script fallbacks:

- `und-Latn`
  - Latin-script text without a stronger hint
- `und-Hani`
  - Han-script text without a stronger hint or carried Japanese context

Current built-in Latin hint buckets:

- `de`
- `es`
- `pt`
- `fr`
- `pl`
- `tr`
- `ro`
- `hu`
- `is`

Current explicit override inputs:

- `--latin-tag`
- `--latin-language`
- `--latin-locale`
- `--latin-hint`
- `--latin-hints-file`
- `--no-default-latin-hints`
- `--han-tag`
- `--han-language`

### 2. `wasm` route

- Optional route selected with `--detector wasm`.
- Current engine: `whatlang` through the WASM runtime.
- Runs only for ambiguous detector windows, not for every chunk.
- Keeps the existing chunk model and relabels only after detector routing succeeds.

Current ambiguous routes eligible for detector evaluation:

- `und-Latn`
- `und-Hani`

Current route gating:

- `und-Latn`
  - requires at least `24` script-bearing Latin characters
- `und-Hani`
  - requires at least `12` script-bearing Han characters

If a window does not meet the route gate, it stays on the original `und-*` route.

## Current Content Gate Surface

The current public content gate surface is global and mode-based.

CLI:

- `--content-gate default|strict|loose|off`

Detector subpath:

- `contentGate: { mode }`

Current mode meanings:

- `default`
  - current fixture-backed project policy
- `strict`
  - tightens Latin-route acceptance so more borderline windows fall back
- `loose`
  - relaxes Latin-route acceptance so more borderline windows may upgrade
- `off`
  - bypasses `contentGate` evaluation only

Current route behavior:

- `und-Latn`
  - meaningfully applies `contentGate`
- `und-Hani`
  - accepts the configured mode but reports `contentGate` as not applied

Current diagnostic contract:

- `contentGate` is the canonical inspect/debug field
- legacy debug/evidence payloads still emit `qualityGate` as a compatibility alias derived from `contentGate.passed`
- inspect-only payloads do not emit `qualityGate`

## Practical Content Gate Verification

`--content-gate` is easiest to verify on borderline Latin-route samples, not on whole documentation files.

Observed practical behavior:

- `default`, `strict`, and `loose` often look identical on highly technical or highly prose-heavy files.
- `off` is much easier to notice on large technical documents because it can promote many `und-Latn` windows that normal policy would keep conservative.
- A file like `README.md` is therefore useful for checking that `off` is active, but it is often a poor calibration sample for checking the difference between `default`, `strict`, and `loose`.

Recommended verification workflow:

1. Use `inspect` first when the goal is to evaluate the gate itself.
2. Use `--debug --detector-evidence` when the goal is to inspect counting-flow event payloads or verify legacy `qualityGate` compatibility.
3. Use short borderline Latin samples that are mixed between config-like lines and real prose.
4. Use whole-document collector output only as a secondary sanity check.

Why `inspect` is the default verification tool:

- `inspect` reports the final canonical gate state directly:
  - `contentGate.applied`
  - `contentGate.passed`
  - `contentGate.policy`
  - `contentGate.mode`
- `--debug --detector-evidence` is still valuable, but it is a runtime event stream for counting flows.
- The debug/evidence path is the right place to verify compatibility behavior such as the legacy `qualityGate` alias.

Suggested commands:

```bash
word-counter inspect --detector wasm --content-gate default \
  "mode: debug
tee: true
path: logs
Use this for testing."

word-counter inspect --detector wasm --content-gate loose \
  "mode: debug
tee: true
path: logs
Use this for testing."

word-counter inspect --detector wasm --content-gate strict \
  "Readers understand this behavior."

word-counter --detector wasm --debug --detector-evidence --content-gate off \
  "mode: debug
tee: true
path: logs
Use this for testing."
```

What to expect:

- `default` vs `loose`
  - borderline mixed technical/prose text may flip between `passed: false` and `passed: true`
- `default` vs `strict`
  - short prose-like lines may flip from accepted gate behavior to conservative fallback behavior
- `off`
  - `contentGate` reports:
    - `applied: false`
    - `policy: "none"`
    - `mode: "off"`
  - legacy debug/evidence payloads still emit `qualityGate: true` as the compatibility alias

Observed example outcomes with the current implementation:

- sample: `Readers understand this behavior.`
  - `default`
    - `contentGate.passed: true`
    - `fallbackReason: "belowThreshold"`
  - `strict`
    - `contentGate.passed: false`
    - `fallbackReason: "qualityGate"`
- sample:
  - `mode: debug`
  - `tee: true`
  - `path: logs`
  - `Use this for testing.`
  - `default`
    - `contentGate.passed: false`
    - `fallbackReason: "qualityGate"`
  - `loose`
    - `contentGate.passed: true`
    - `fallbackReason: "belowThreshold"`

Those examples are more sensitive than whole-document tests on `README.md`, where `strict` and `loose` may legitimately look identical while `off` still shows a large shift.

## Current WASM Engine Remap Support

The WASM engine returns engine-native values first. Those values are not emitted directly as the public tag contract. They are remapped through the current allow-list in `src/detector/whatlang-map.ts`.

### `und-Latn` allow-list

Current engine-to-public remaps:

| Engine language | Public tag |
| --- | --- |
| `cat` | `ca` |
| `ces` | `cs` |
| `dan` | `da` |
| `deu` | `de` |
| `eng` | `en` |
| `fin` | `fi` |
| `fra` | `fr` |
| `hun` | `hu` |
| `ita` | `it` |
| `lat` | `la` |
| `nld` | `nl` |
| `pol` | `pl` |
| `por` | `pt` |
| `ron` | `ro` |
| `spa` | `es` |
| `swe` | `sv` |
| `tur` | `tr` |

Additional route requirement:

- engine script must be `Latin`

### `und-Hani` allow-list

Current engine-to-public remaps:

| Engine language | Public tag |
| --- | --- |
| `cmn` | `zh` |
| `jpn` | `ja` |

Additional route requirements:

- `cmn`
  - engine script must be `Mandarin`
- `jpn`
  - engine script may be `Mandarin`, `Hiragana`, or `Katakana`

Current non-goal:

- the WASM route does not auto-emit `zh-Hans` or `zh-Hant`

## Remap Process

The current remap process is:

1. Run the regex/script route first to create the initial chunk stream.
2. Build detector windows only for ambiguous routes:
   - `und-Latn`
   - `und-Hani`
3. Apply route gating based on script-bearing character counts.
4. Build detector samples for the window:
   - raw sample
   - normalized sample when applicable
   - borrowed adjacent Japanese context for some `und-Hani` windows
5. Run the current WASM engine (`whatlang`) on the sample.
6. Reject the engine result if the script is incompatible with the route.
7. Remap the engine language through the current allow-list in `src/detector/whatlang-map.ts`.
8. Reject the candidate if the remap returns `null`.
9. Apply confidence and reliability policy from the route policy.
10. If accepted, relabel the affected chunks to the remapped public tag.
11. If not accepted, fall back to the original ambiguous `und-*` route.

## Why Unsupported Languages Fall Back

The current WASM engine may still produce a raw engine result for a language that the package does not currently expose as a supported public tag.

Example:

- Indonesian text can produce:
  - engine language: `ind`
  - engine script: `Latin`
- The current Latin remap allow-list does not include `ind`.
- That means the remap step returns `null`.
- The detector path then falls back to `und-Latn` even though the engine produced a raw result.

This is expected current behavior, not a runtime failure.

## Practical User Expectations

- If you want deterministic script-based behavior, use the default `regex` route.
- If you want conservative promotion for ambiguous Latin or Han windows, use `--detector wasm`.
- If you need a language tag that is not in the current WASM allow-list, the detector may still observe it internally but will fall back to `und-*`.
- If you need a specific Latin or Han tag today, use explicit hints or overrides.

## Related Docs

- `docs/locale-tag-detection-notes.md`
- `docs/schemas/detector-remap-contract.md`
- `docs/schemas/detector-inspector-output-contract.md`
