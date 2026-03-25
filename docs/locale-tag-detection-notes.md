---
title: "Locale Tag Detection Notes"
created-date: 2026-02-19
modified-date: 2026-03-23
status: active
agent: Codex
---

## Purpose

Document current locale-tag detection behavior, known limits, and override flags.

For the current supported-route and remap overview, see `docs/language-detection-support-guide.md`.

## Detection Model

- Default detection is regex/script based (Unicode script checks), not a statistical language-ID model.
- Ambiguous Latin text uses `und-Latn` unless a Latin hint is provided.
- Han-script fallback uses `und-Hani` by default because regex script checks cannot natively distinguish `zh-Hans` vs `zh-Hant`.
- `--detector wasm` is an optional detector-assisted route for ambiguous chunks only.
- The first WASM detector engine is `whatlang`, remapped into this package's public tag contract.
- `--detector regex` keeps the existing chunk-first detection behavior.
- `--detector wasm` keeps the counting chunk model but uses a detector-oriented ambiguous-window scoring pass before relabeling those chunks.

## Built-in Latin Diacritic Heuristics

- `de`: `äöüÄÖÜß`
- `es`: `ñÑ¿¡`
- `pt`: `ãõÃÕ`
- `fr`: `œŒæÆ`
- `pl`: `ąćęłńśźżĄĆĘŁŃŚŹŻ`
- `tr`: `ıİğĞşŞ`
- `ro`: `ăĂâÂîÎșȘțȚ`
- `hu`: `őŐűŰ`
- `is`: `ðÐþÞ`

## Overrides and Inspection

- Use `--detector <mode>` to select detection mode:
  - `regex` (default)
  - `wasm`
- Use `--latin-language <tag>` or `--latin-tag <tag>` for ambiguous Latin text.
- Use `--latin-hint <tag>=<pattern>` (repeatable) and `--latin-hints-file <path>` to add custom Latin rules.
- Use `--no-default-latin-hints` to disable built-in Latin diacritic rules.
- Use `--han-language <tag>` or `--han-tag <tag>` for Han-script fallback.
- Use `--mode chunk`/`--mode segments` or `--format json` to inspect assigned locale tags per chunk.
- `--latin-locale` remains supported as a legacy alias for now and is planned for future deprecation.

## Known Limits

- Regex/script-only detection cannot reliably identify English vs other Latin-script languages.
- Latin text with unsupported diacritic patterns may remain in `und-Latn` unless hints are provided.
- WASM detection is conservative:
  - `und-Latn`
    - `default|off`: requires at least 24 script-bearing Latin characters
    - `strict`: requires at least 30 script-bearing Latin characters
    - `loose`: requires at least 20 script-bearing Latin characters
  - `und-Hani`
    - `default|off`: requires at least 12 script-bearing characters from the Hani diagnostic sample
    - `strict`: requires at least 16 script-bearing characters from the Hani diagnostic sample
    - `loose`: requires at least 4 Han characters in the focus window
- For ambiguous Latin text, the detector can also use a corroborated script-bearing sample path before accepting a tag.
- For ambiguous Hani text, `loose` is a short-window idiom path and does not treat borrowed Japanese context alone as sufficient.
- Low-confidence or unreliable WASM detector results fall back to the original `und-*` tag.
- `whatlang`-backed Han detection does not auto-emit `zh-Hans` or `zh-Hant`.
- 100% certainty requires explicit metadata (document language tags, user-provided locale, headers) or a language-ID model.
