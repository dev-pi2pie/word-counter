---
title: "Breaking Changes Notes"
created-date: 2026-02-15
modified-date: 2026-02-20
status: active
agent: Codex
---

## Purpose

Track possible breaking changes and deprecation plans before stable `v0.1.0`.

## Planned Deprecations

- `--latin-locale <locale>` is now a legacy alias.
- Preferred replacements are `--latin-language <tag>` and `--latin-tag <tag>`.
- Planned action: deprecate `--latin-locale` in a later release after canary feedback.

## CLI Behavior Changes (Batch Diagnostics)

- Batch jobs routing now removes active `load-only` strategy usage and keeps only `load+count` execution paths.
- Diagnostics output policy is now unified into explicit tiers:
  - errors (always shown)
  - warnings (shown by default, suppressible)
  - debug (`--debug`, with per-item details under `--verbose`)
- Batch warnings now include worker-fallback and jobs-limit advisory messaging.
- `--quiet-warnings` is available for low-noise operational runs.
- `--quiet-skips` remains debug-gated for skip diagnostics and skip payload suppression in per-file JSON debug flows.

Tracking plan:

- `docs/plans/plan-2026-02-20-batch-jobs-route-cleanup-and-diagnostics-noise.md`

## Language Tag Notes

- Han-script default fallback moved to `und-Hani` for script-level labeling without forcing `zh`.
- Simplified (`zh-Hans`) vs Traditional (`zh-Hant`) cannot be reliably auto-detected by Unicode script regex alone.
- Use `--han-language <tag>` or `--han-tag <tag>` when a specific Han variant is required.

## Compatibility Intent

- Keep existing output field name `locale` during canary releases.
- Treat values as BCP 47 locale tags, with defaults favoring language/script-style tags over region-specific variants.
- Revisit output key naming after canary feedback.
