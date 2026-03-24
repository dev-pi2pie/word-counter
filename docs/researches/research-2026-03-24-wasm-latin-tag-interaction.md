---
title: "wasm detector and latin-tag interaction"
created-date: 2026-03-24
modified-date: 2026-03-24
status: draft
agent: codex
---

## Goal

Document the unexpected interaction where `--detector wasm` plus `--latin-tag <tag>` changes collector totals and removes detector-derived locales such as `fr` in real CLI output.

## Key Context

- Reported against `0.1.5-canary.2`.
- Scope here is investigation and issue framing only.
- This note does not propose or record an implementation yet.

## Reproduction

Observed baseline:

```bash
node dist/esm/bin.mjs -p README.md -m colle --detector wasm
```

Observed output:

```text
Total words: 3249
Locale en: 2988 words
Locale und-Hani: 26 words
Locale ko: 4 words
Locale und-Latn: 143 words
Locale ja: 2 words
Locale ar: 2 words
Locale pl: 20 words
Locale tr: 10 words
Locale de: 15 words
Locale ro: 4 words
Locale zh: 8 words
Locale fr: 27 words
```

Observed with `--latin-tag en`:

```bash
node dist/esm/bin.mjs -p README.md -m colle --detector wasm --latin-tag en
```

Observed output:

```text
Total words: 3254
Locale en: 3170 words
Locale und-Hani: 26 words
Locale ko: 4 words
Locale ja: 2 words
Locale ar: 2 words
Locale pl: 16 words
Locale tr: 9 words
Locale de: 13 words
Locale ro: 4 words
Locale zh: 8 words
```

## Key Findings

- The WASM detector path is still used when `--detector wasm` is set.
- The interaction changes earlier than the detector stage:
  - `resolveCountRunOptions()` forwards `options.latinTag` into `wcOptions.latinTagHint`.
  - `segmentTextByLocaleWithWasmDetector()` calls `segmentTextByLocale(text, options)` before any WASM remap work.
  - `detectLocaleForChar()` returns `context.latinHint` for ambiguous Latin characters when `latinTagHint` is present.
- Because of that early hinting, many Latin runs become `en` during base segmentation instead of remaining `und-Latn`.
- The WASM detector only evaluates ambiguous routes (`und-Latn`, `und-Hani`), so pre-labeled `en` chunks are skipped entirely.
- Result:
  - detector-derived locales such as `fr` disappear because those chunks never remain ambiguous long enough to reach the WASM route
  - totals can also change because counting uses `Intl.Segmenter(locale, { granularity: "word" })`, so changing a chunk locale from `und-Latn` to `en` changes the segmenter used for final word counting

## Implications or Recommendations

- Current behavior matches "hint overrides ambiguity before detection", not "run WASM first, then relabel only unresolved `und-Latn` buckets".
- If the intended contract is that hint-based language tagging belongs to regex mode, `latinTagHint` should not be applied during the pre-detector segmentation pass for WASM mode.
- One candidate model for WASM mode is:
  - keep ambiguous Latin as `und-Latn` for detector eligibility
  - run WASM remap on ambiguous windows
  - apply `latinTagHint` only as a fallback for windows/chunks that remain unresolved after detector evaluation
