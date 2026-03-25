---
title: "oxlint and oxfmt config review"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Review the newly added `oxlint` and `oxfmt` configuration, trim any unnecessary defaults, and make small repo-specific tweaks where needed.

## What Changed

- Simplified `.oxlintrc.json` to the repo-specific settings that matter:
  - builtin environment enabled
  - ignore patterns for generated and non-source directories
- Simplified `.oxfmtrc.json` to the same repo-specific ignore set.
- Added `generated/**` to both ignore lists to match the repo's existing generated-output handling.
- Updated `package.json` formatting scripts to include `tsconfig.test.json` alongside `tsconfig.json`.

## Validation

- Ran `bun run lint`.
- Ran `bun run format:check`.
- Confirmed that `lint` succeeds and that the remaining `format:check` failure is due to existing source files not yet formatted with `oxfmt`, not a configuration error.
