---
title: "Locale Tag Detection Notes"
created-date: 2026-02-19
status: active
agent: Codex
---

## Purpose

Document current locale-tag detection behavior, known limits, and override flags.

## Detection Model

- Detection is regex/script based (Unicode script checks), not a statistical language-ID model.
- Ambiguous Latin text uses `und-Latn` unless a Latin hint is provided.
- Han-script fallback uses `und-Hani` by default because regex script checks cannot natively distinguish `zh-Hans` vs `zh-Hant`.

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

- Use `--latin-language <tag>` or `--latin-tag <tag>` for ambiguous Latin text.
- Use `--latin-hint <tag>=<pattern>` (repeatable) and `--latin-hints-file <path>` to add custom Latin rules.
- Use `--no-default-latin-hints` to disable built-in Latin diacritic rules.
- Use `--han-language <tag>` or `--han-tag <tag>` for Han-script fallback.
- Use `--mode chunk`/`--mode segments` or `--format json` to inspect assigned locale tags per chunk.
- `--latin-locale` remains supported as a legacy alias for now and is planned for future deprecation.

## Known Limits

- Regex/script-only detection cannot reliably identify English vs other Latin-script languages.
- Latin text with unsupported diacritic patterns may remain in `und-Latn` unless hints are provided.
- 100% certainty requires explicit metadata (document language tags, user-provided locale, headers) or a language-ID model.
