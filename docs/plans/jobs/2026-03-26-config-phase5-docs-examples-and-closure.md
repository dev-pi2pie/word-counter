---
title: "config phase 5 docs examples and closure"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Complete Phase 5 of `docs/plans/plan-2026-03-26-config-file-support-and-detector-defaults.md` by shipping the final config guide, example config files, README updates, and closure status updates across the related docs.

## What Changed

- Added `docs/config-usage-guide.md` covering:
  - canonical filenames
  - platform-native user config locations
  - current-working-directory lookup
  - same-scope file priority
  - ignored-sibling behavior
  - merge rules
  - detector inheritance and override rules
- Added default-reference config examples under `examples/wc-config/`:
  - `wc-intl-seg.config.toml`
  - `wc-intl-seg.config.json`
  - `wc-intl-seg.config.jsonc`
- Updated `README.md` with:
  - config file naming and precedence
  - same-scope priority notes
  - the `-d` alias
  - the corrected inspect engine example with explicit `--detector wasm`
  - links to the config guide and example files
- Updated `docs/schemas/default-config.md` to reflect the final default example shape and completed status.
- Marked the related research and plan docs as completed after the implementation, docs, examples, tests, and reviews were finished.

## Validation

- `bun test`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-26-config-file-support-and-detector-defaults.md`

## Related Research

- `docs/researches/research-2026-03-26-config-layer-and-detector-defaults.md`
