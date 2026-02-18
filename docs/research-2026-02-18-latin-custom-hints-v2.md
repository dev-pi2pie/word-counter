---
title: "Custom Latin Hints v2 for Locale Tag Detection"
created-date: 2026-02-18
modified-date: 2026-02-18
status: draft
agent: Codex
---

## Goal
Define an implementation-ready v2 design for custom Latin hinting so users can improve European diacritic detection without over-claiming language identity.

## Milestone Goal
Provide a low-risk, backward-compatible enhancement for the next `v0.1.x` iteration.

## Current State and Gap
- Current Latin fallback is `und-Latn`, with built-in diacritic hints for:
  - `de`: `äöüÄÖÜß`
  - `es`: `ñÑ¿¡`
  - `pt`: `ãõÃÕ`
  - `fr`: `œŒæÆ`
- This is intentionally conservative but misses many common European diacritics (for example `áéíóú`, `àèìòù`, `âêîôû`, `å`, `ø`, `ç`, `ł`, `ğ`, `ș`, `ž`).
- Result: many real-world Latin runs remain `und-Latn` unless users force a broad fallback with `--latin-language` / `--latin-tag`.

## Key Findings
- Regex/script routing is still the correct fast first pass; it should remain the boundary for “what script is this?”.
- Expanding built-in hints aggressively is risky because many accented characters overlap across multiple languages.
- A built-in default hint library is still useful for out-of-the-box behavior and documentation clarity.
- User-defined hints are necessary so projects can tune behavior for their domain without patching core code.
- The safest incremental design is to keep the existing per-character hinting model and make the hint table configurable.

## Recommended v2 Design

### Default Latin Hint Library (Built-In)
Maintain defaults as TypeScript constants (not runtime JSON) for bundle/runtime stability:

```ts
export const DEFAULT_LATIN_HINT_RULES: LatinHintRule[] = [
  { tag: "de", pattern: /[äöüÄÖÜß]/u },
  { tag: "es", pattern: /[ñÑ¿¡]/u },
  { tag: "pt", pattern: /[ãõÃÕ]/u },
  { tag: "fr", pattern: /[œŒæÆ]/u },
];
```

Design note:
- Keep the canonical defaults in code so they are versioned and testable.
- JSON should be optional input for user custom rules only.

### Data Model (Library API)
Add optional custom Latin rules:

```ts
export interface LatinHintRule {
  tag: string; // BCP 47 tag, e.g. "pl", "pt", "fr-CA"
  pattern: string | RegExp; // must match a single character in runtime evaluation
  priority?: number; // higher wins on same character (default: 0)
}
```

```ts
export interface WordCounterOptions {
  // existing fields...
  latinHintRules?: LatinHintRule[];
}
```

Design note:
- Keep this as a flat option in `WordCounterOptions` for minimal change scope.
- A larger `localeDetection` object can still be introduced later if needed.

### CLI Contract
Add repeatable CLI hints and optional file loading:

- `--latin-hint <tag>=<pattern>` (repeatable)
- `--latin-hints-file <path>` (JSON file with an array of rules)
- `--no-default-latin-hints` (optional: disable built-in defaults)

Examples:

```bash
word-counter --latin-hint 'pl=[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' "Zażółć gęślą jaźń"
word-counter --latin-hint 'tr=[çğıöşüÇĞİÖŞÜ]' --latin-hint 'ro=[ăâîșțĂÂÎȘȚ]' "șță"
word-counter --latin-hints-file ./latin-hints.json "Crème brûlée"
```

### Merge and Precedence (Deterministic)
For Latin characters:
1. build effective hint rules:
   - default mode: `custom rules` then `built-in rules`
   - with `--no-default-latin-hints`: `custom rules` only
2. best match is selected by:
   - higher `priority`
   - then first-defined rule order
3. previous detected non-default Latin locale continues within the run (existing behavior)
4. explicit Latin fallback hint remains final fallback when no rule matched:
   - `latinTagHint` > `latinLanguageHint` > `latinLocaleHint`
5. default fallback remains `und-Latn`

Rationale:
- Keeps current segmentation behavior stable.
- Adds configurability without forcing a two-pass rewrite.

## Validation Rules
- `tag` must be non-empty after trim.
- `pattern` must compile as a JavaScript `RegExp` with `u` support.
- Empty patterns are rejected.
- Invalid hint entries fail fast with a clear CLI/API error.
- Optional guardrail: cap pattern length (for example `<= 256`) to reduce misuse risk.

## Compatibility Impact
- No change to default behavior when no custom hints are provided.
- Existing options (`--latin-language`, `--latin-tag`, `--latin-locale`) continue to work.
- Output shape stays unchanged (`locale` field, existing breakdown structures).
- Users can overwrite default behavior by providing custom rules and optionally disabling defaults.

## Suggested Test Matrix
- API:
  - accepts `latinHintRules` with string and `RegExp` patterns
  - rejects invalid regex patterns
  - honors `priority` tie-break rules
- CLI:
  - parses repeated `--latin-hint`
  - merges `--latin-hints-file` with CLI-provided hints deterministically
  - supports `--no-default-latin-hints` replacement mode
  - fails fast on malformed `<tag>=<pattern>`
- Behavior:
  - custom hint upgrades `und-Latn` to expected tag
  - no custom hints => current behavior unchanged
  - explicit `--latin-tag` still acts as fallback when no custom/built-in match

## Implications / Recommendations
- Implement this as a focused incremental change rather than broad built-in table expansion.
- Keep built-ins conservative and document them; encourage project-specific customization for ambiguous language families.
- After this ships, gather sample corpora to evaluate whether chunk-level scoring is needed in a future v3.

## Open Questions
- Should custom hints be able to disable built-in hints entirely (`--no-default-latin-hints`)?
- Should we support explicit regex flags in CLI patterns (for example `/.../iu`) or keep `u`-only for predictability?

## Related Plans
- `docs/plans/plan-2026-01-14-latin-ambiguous-locale.md`
- `docs/plans/plan-2026-01-02-wc-refactor-locale-research.md`

## Related Research
- `docs/research-2026-01-02-language-detection.md`
- `docs/research-2026-01-02-word-counter-options.md`

## References
[^1]: https://www.rfc-editor.org/rfc/rfc5646
[^2]: https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
[^3]: https://www.unicode.org/reports/tr24/
[^4]: https://www.unicode.org/reports/tr18/
[^5]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Unicode_property_escapes
