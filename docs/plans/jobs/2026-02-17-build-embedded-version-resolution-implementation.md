---
title: "build embedded version resolution implementation"
created-date: 2026-02-17
modified-date: 2026-02-17
status: completed
agent: Codex
---

## Goal

Implement build-embedded version resolution so CLI `--version` remains correct when `dist` and runtime dependencies are relocated without `package.json`.

## What Changed

- Added build generator script:
  - `scripts/generate-embedded-version.mjs`
  - reads root `package.json` version and writes `src/cli/program/version-embedded.ts`
  - emits concise status logs with package name and version transition:
    - `created (none -> x.y.z)`
    - `updated a.b.c -> x.y.z`
    - `unchanged (x.y.z)`
- Updated build pipeline:
  - `package.json` `build` now runs generator before `tsdown`
- Added embedded version module:
  - `src/cli/program/version-embedded.ts`
- Updated runtime version resolver:
  - `src/cli/program/version.ts` now prefers embedded version first
  - keeps package-search fallback
  - keeps final `0.0.0` fallback
- Added resolver unit tests:
  - `test/version-resolution.test.ts`
  - covers embedded-first, package fallback, default fallback

## Validation

- `bun test` passed (`121 pass`).
- `bun run build` passed.
- Manual relocated artifact check passed:
  - copied `dist` + `node_modules` to temp dir without `package.json`
  - `node dist/esm/bin.mjs --version` reported embedded version (`ver.0.1.1-canary.1`).

## Related Plans

- `docs/plans/plan-2026-02-17-build-embedded-version-resolution.md`
