---
title: "Breaking Changes Notes"
created-date: 2026-02-15
modified-date: 2026-02-15
status: active
agent: Codex
---

## Purpose

Track possible breaking changes and deprecation plans before stable `v0.1.0`.

## Planned Deprecations

- `--latin-locale <locale>` is now a legacy alias.
- Preferred replacements are `--latin-language <tag>` and `--latin-tag <tag>`.
- Planned action: deprecate `--latin-locale` in a later release after canary feedback.

## Language Tag Notes

- Han-script default fallback moved to `zh-Hani` for script-level labeling.
- Simplified (`zh-Hans`) vs Traditional (`zh-Hant`) cannot be reliably auto-detected by Unicode script regex alone.
- Use `--han-language <tag>` or `--han-tag <tag>` when a specific Han variant is required.

## Compatibility Intent

- Keep existing output field name `locale` during canary releases.
- Treat values as BCP 47 locale tags, with defaults favoring language/script-style tags over region-specific variants.
- Revisit output key naming after canary feedback.
