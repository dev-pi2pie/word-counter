---
title: "Language Detection With Unicode Scripts and Regex"
created-date: 2026-01-02
modified-date: 2026-02-18
status: completed
agent: Codex
---

## Goal
Document how far regex-based detection can go for language identification, and what Unicode data is reliable for script detection in Node.js.

## Key Findings
- Unicode defines Script and Script_Extensions properties to describe the script association of characters; Script_Extensions provides a set of scripts for characters used with multiple scripts. This data is intended for regex and text processing, not for identifying a specific language. [^1][^2]
- Unicode blocks are just code point ranges; blocks and scripts do not map 1:1, and scripts are preferred for regex classification. [^1]
- JavaScript regular expressions support Unicode property escapes like `\p{Script=Latin}` and `\p{Script_Extensions=Latin}` when using the `u` flag. [^3]
- JavaScript regex supports `Han`/`Hani` script properties, but does not expose `Hans`/`Hant` as regex script properties. Simplified vs Traditional distinction therefore needs hints/heuristics, not script property matching. (Inference from runtime validation.)
- CLDR provides likely-subtag data used to expand language tags to likely script/region defaults; this is metadata for tags, not a language-identification mechanism. [^4]
- BCP 47 allows script-only-style tagging with an undetermined language (for example `und-Latn`, `und-Hani`). For regex-only script detection, this avoids over-claiming a specific language when only script is known. [^5][^6][^7]

## Implications (Regex-Only)
- Regex can reliably separate scripts (e.g., Han vs. Hangul), but cannot reliably distinguish languages that share the same script (e.g., English vs. French vs. Dutch within Latin). This is a limitation of script data, not of regex syntax. (Inference based on the Script/Script_Extensions design.) [^1]
- For Latin text, any regex-only approach must either accept a single default locale bucket or use heuristic rules (diacritics, stopwords, or frequency). Such heuristics are inherently ambiguous for many languages that share the same letter set. (Inference.)

## Recommendations for This Repo
1. Prefer Script_Extensions (`scx`) for script detection where shared characters are expected. This helps keep punctuation/marks aligned with the surrounding script instead of falling into a generic bucket. [^2][^1]
2. Use `und-Latn` as the default for ambiguous Latin runs to avoid incorrect `en` attribution; keep a separate resolved locale only when required for compatibility. (Inference.)
3. If expanded script coverage is desired, add new script regexes based on the Unicode Script property list and prioritize them using observed input data. [^1]
4. If true language identification is required, plan for a statistical or dictionary-based detector rather than regex-only heuristics. (Inference.)

## Current Implementation Notes
- Default Latin locale is `und-Latn` (script-only tag for undetermined Latin).
- Han-script fallback defaults to `und-Hani`; explicit Han variant tags (`zh-Hans` / `zh-Hant`) should be supplied through hints when required.
- Region-specific tags have been dropped where possible: `ja`, `ko`, `th`, `ru`, `ar`, `hi`.
- Latin diacritic hints are used to label `de`, `es`, `pt`, and `fr` when matching characters appear.
- Latin hints only affect the locale when a matching diacritic is present; otherwise runs stay in the default Latin bucket.

## Regex Patterns (Node.js / JS)
Use Unicode property escapes with the `u` flag:

```ts
const isLatin = /\p{Script=Latin}/u;
const isLatinScx = /\p{Script_Extensions=Latin}/u;
const isGreek = /\p{Script=Greek}/u;
```

`Script_Extensions` should be preferred when you need shared characters (digits, punctuation, marks) to inherit the current script run. [^2][^1]

## Link Style Note
This doc uses footnote-style references (e.g., `[^1]`) with the URLs listed at the end of the file.

## Status Note
This research is marked `completed` for the `v0.1.0` scope. Future heuristic refinements can be tracked in follow-up research if needed.

## Related Plans
- `docs/plans/plan-2026-01-02-wc-refactor-locale-research.md`

## References
[^1]: https://www.unicode.org/reports/tr24/
[^2]: https://www.unicode.org/reports/tr18/
[^3]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Unicode_property_escapes
[^4]: https://cldr.unicode.org/index/cldr-spec/picking-the-right-language-code
[^5]: https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
[^6]: https://www.rfc-editor.org/rfc/rfc5646
[^7]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/Locale
