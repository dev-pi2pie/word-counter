---
title: "build-embedded version resolution"
created-date: 2026-02-17
modified-date: 2026-02-17
status: completed
agent: Codex
---

## Goal

Make CLI version output stable for relocated build artifacts (for example, running `node dist/esm/bin.mjs --version` without a nearby `package.json`).

## Problem

Current version resolution reads `package.json` by searching upward from runtime paths. If `dist` is moved without `package.json`, version falls back to `0.0.0`.

## Scope

- Add build-time embedded version metadata consumed by runtime version resolution.
- Keep `package.json` lookup as fallback for local development.
- Preserve current CLI output format and existing `--version` UX.

## Out of Scope

- Changing version string style (`ver.x.y.z`) or color formatting.
- Redesigning release/tagging workflow.
- Adding network-based version lookup.

## Proposed Design

1. Build-time artifact:
   - Generate a small version metadata module during build, for example:
   - `dist/esm/version.mjs` and `dist/cjs/version.cjs`
   - Export a single constant: embedded package version.
2. Runtime resolution priority:
   - First: embedded version module.
   - Second: existing `package.json` search logic.
   - Last: `"0.0.0"` fallback.
3. Dev ergonomics:
   - Source tree can keep current behavior when running from `src` (no dist artifact yet).
   - Dist builds always carry version information.

## Implementation Plan

- [x] Add a build step that writes version metadata from root `package.json`.
- [x] Ensure built CLI artifacts receive embedded version data.
- [x] Update runtime version resolver to prefer embedded version when available.
- [x] Keep existing `package.json` walk-up fallback logic for dev/non-built runs.
- [x] Add tests for:
  - built artifact with no nearby `package.json` still reports correct version
  - fallback to `package.json` still works in source/dev runs
  - default `"0.0.0"` only when both embedded and `package.json` are unavailable
- [x] Validate relocated `dist/esm/bin.mjs --version` behavior without nearby `package.json` (with runtime deps present).

## Acceptance Criteria

- Running built CLI from relocated `dist` still reports the actual package version.
- Existing local development behavior remains intact.
- Version fallback behavior is deterministic and test-covered.
- No regression in current CLI version output styling.

## Risks and Mitigations

- Risk: Embedded metadata diverges from `package.json`.
- Mitigation: Generate metadata in build pipeline from root `package.json` each build.

- Risk: ESM/CJS output parity drift.
- Mitigation: Include tests for both module entry paths.

- Risk: Bundler integration complexity.
- Mitigation: Use minimal generated file approach and explicit imports.

## Related Plans

- `docs/plans/plan-2026-02-17-path-mode-clarity-and-regex-filtering.md`
