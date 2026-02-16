---
title: "Fix CLI version resolution after command modularization"
created-date: 2026-02-16
status: completed
agent: Codex
---

## Summary

- Found a post-refactor regression where the built CLI (`dist/esm/bin.mjs`) printed `ver.0.0.0` instead of the package version.
- Source-run CLI (`bun run src/bin.ts --version`) still printed the correct version, so the issue was specific to bundled path resolution.

## Root Cause

- `src/cli/program/version.ts` used fixed relative path candidates tied to source layout.
- After bundling, module location depth changed and those static candidate paths no longer resolved to repository `package.json`, triggering fallback to `0.0.0`.

## Resolution

- Replaced static candidate paths with deterministic upward search across multiple roots:
  - module directory (`import.meta.url`)
  - entrypoint directory (`process.argv[1]`)
  - current working directory (`process.cwd()`)
- Added bounded parent traversal and first-hit `package.json` `version` extraction.

## Verification

- `bun run src/bin.ts --version` -> `word-counter ver.0.1.0`
- `bun run build` (rebuild dist)
- `node dist/esm/bin.mjs --version` -> `word-counter ver.0.1.0`

## Related Plans

- `docs/plans/plan-2026-02-16-command-ts-separation-pass-2.md`
- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
