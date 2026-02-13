---
title: "Language Detection With Unicode Scripts and Regex"
created-date: 2026-01-02
modified-date: 2026-01-14
status: in-progress
agent: Codex
---

## Goal
Document how far regex-based detection can go for language identification, and what Unicode data is reliable for script detection in Node.js.

## Key Findings
- Unicode defines Script and Script_Extensions properties to describe the script association of characters; Script_Extensions provides a set of scripts for characters used with multiple scripts. This data is intended for regex and text processing, not for identifying a specific language. [^1][^2]
- Unicode blocks are just code point ranges; blocks and scripts do not map 1:1, and scripts are preferred for regex classification. [^1]
- JavaScript regular expressions support Unicode property escapes like `\p{Script=Latin}` and `\p{Script_Extensions=Latin}` when using the `u` flag. [^3]
- CLDR provides likely-subtag data used to expand language tags to likely script/region defaults; this is metadata for tags, not a language-identification mechanism. [^4]

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
- Region-specific tags have been dropped where possible: `ja`, `ko`, `th`, `ru`, `ar`, `hi`, `zh-Hans`.
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
This research is marked `in-progress` because it is discovery-driven: findings may change as we test real inputs and refine detection heuristics.

## Related Plans
- `docs/plans/plan-2026-01-02-wc-refactor-locale-research.md`

## References
[^1]: https://www.unicode.org/reports/tr24/
[^2]: https://www.unicode.org/reports/tr18/
[^3]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Unicode_property_escapes
[^4]: https://cldr.unicode.org/index/cldr-spec/picking-the-right-language-code
