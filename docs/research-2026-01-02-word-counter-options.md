---
title: "WordCounterOptions: Current vs Future Config"
date: 2026-01-02
modified-date: 2026-01-15
status: completed
agent: Codex
---

## Goal
Document the current `WordCounterOptions` API, propose an extensible future shape, and outline phased delivery for configuration-driven locale detection.

## Current State `ver 0.0.3 ~ ver 0.0.4`
The current `WordCounterOptions` only exposes the output mode selector:

```ts
export interface WordCounterOptions {
  mode?: "chunk" | "segments" | "collector";
}
```

This keeps the API minimal and stable but does not allow configuration of locale detection behavior.

## Why a Config Layer Is Needed
- Locale detection depends on Unicode script data and BCP 47 language tags, which support language-only tags like `en` as well as script and region subtags. [^1][^2]
- `Intl.Segmenter` accepts locale tags and tailors segmentation to the specified language or script, so exposing locale policy is meaningful for users. [^3]
- Unicode Script and Script_Extensions data can improve script-run detection, but cannot distinguish languages that share a script; therefore a user-configurable policy is the safest way to evolve behavior. [^4][^5]

## Proposed Future Shape (Configurable)
Introduce a focused configuration layer for locale detection without changing the default behavior:

```ts
export interface LocaleHintRule {
  locale: string; // e.g., "fr"
  pattern: RegExp; // e.g., /[\u0153\u0152\u00e6\u00c6]/
}

export interface LocaleDetectionOptions {
  defaultLocale?: string; // default: "und-Latn"
  latinHints?: LocaleHintRule[]; // optional overrides
}

export interface WordCounterOptions {
  mode?: WordCounterMode;
  localeDetection?: LocaleDetectionOptions;
}
```

### JSON-Friendly Variant (Phase 2)
For CLI usage or config files, use a JSON representation where regex patterns are serialized:

```json
{
  "mode": "chunk",
  "localeDetection": {
    "defaultLocale": "und-Latn",
    "latinHints": [
      { "locale": "fr", "pattern": "[\\u0153\\u0152\\u00e6\\u00c6]" }
    ]
  }
}
```

A small adapter can compile `pattern` strings into `RegExp` at runtime.

## Phases
### Phase 1 (Code-Only Options)
- Add `localeDetection` to `WordCounterOptions`.
- Accept `defaultLocale` and `latinHints` as runtime options (no file IO).
- Preserve current defaults when options are not provided.

### Phase 2 (Config File / CLI)
- Allow a JSON file or CLI flags to supply `localeDetection`.
- Validate patterns and report configuration errors.
- Document a stable schema for config files.

## Similar Approaches (Reference Points)
- BCP 47 tags allow language-only labels when region is not required, and also permit script-only tags like `und-Latn` for undetermined Latin text. [^1][^2]
- `Intl.Segmenter` locale tailoring is driven by these tags, so exposing locale configuration matches the platform API. [^3]
- Unicode Script and Script_Extensions support script-aware segmentation logic but do not imply a unique language, motivating a user-configurable layer. [^4][^5]

> [!NOTE]
> 2026-01-14: Default Latin detection now uses `und-Latn` instead of `en` to avoid incorrect English attribution for ambiguous Latin text.

## Link Style Note
This doc uses footnote-style references (e.g., `[^1]`) with the URLs listed at the end of the file.

## Related Plans
- `docs/plans/plan-2026-01-02-wc-refactor-locale-research.md`

## References
[^1]: https://developer.mozilla.org/en-US/docs/Glossary/BCP_47_language_tag
[^2]: https://www.rfc-editor.org/rfc/rfc5646
[^3]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/Segmenter
[^4]: https://www.unicode.org/reports/tr24/
[^5]: https://www.unicode.org/reports/tr18/
