---
title: "Handle Ambiguous Latin Locale with und-Latn"
created-date: 2026-01-14
modified-date: 2026-01-15
status: completed
agent: Codex
---

_Why_: Regex/script-only detection cannot reliably identify Latin-script languages, so we label ambiguous Latin runs explicitly to avoid incorrect `en` attribution.

## Scope
- Replace default Latin fallback locale with an explicit script-only bucket (e.g., `und-Latn`).
- Preserve current public API and Node.js compatibility.
- Document rationale and compatibility notes for downstream consumers.

## Goals
- Avoid incorrect language labeling for Latin text without strong hints.
- Keep segmentation behavior stable by using a neutral fallback locale chain.
- Make locale detection semantics explicit and honest.

## Proposed Changes
- Update locale detection to return `und-Latn` (or `mul-Latn`) for ambiguous Latin runs.
- Keep diacritic-based hints to upgrade to `de`, `es`, `pt`, `fr` when matched.
- If required for compatibility, introduce a resolved locale (e.g., `en`) only at output boundaries.
- Optionally pass locale priority list to `Intl.Segmenter` (e.g., `[detectedLocale, "und-Latn"]`).

## Compatibility Notes
- If any consumers expect `en` as the default Latin bucket, provide a migration note or compatibility switch.
- Ensure tests cover unchanged word counts and segmentation for Latin text without hints.
- Regex/script-only detection cannot guarantee `en`; 100% certainty requires explicit metadata (document language tags, user-provided locale, headers) or a language-ID model.

## Implementation Steps
1. Use `und-Latn` as the default for ambiguous Latin runs and document the choice.
2. Update `DEFAULT_LOCALE` (and related tests) to the new default.
3. Adjust segmenter usage to include a fallback locale chain if needed.
4. Run the full test suite to confirm existing tests behave as expected after the change.
5. Add/refine tests for ambiguous Latin input ensuring stable segmentation and counts.
6. Update docs/research note to record the rationale.

## References
- https://www.rfc-editor.org/rfc/rfc5646 — Defines BCP 47 tags, including `und` and `mul`.
- https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry — Registry of script subtags like `Latn`.
