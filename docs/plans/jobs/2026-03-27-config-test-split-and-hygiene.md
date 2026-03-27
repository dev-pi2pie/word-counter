---
title: "config test split and hygiene fixes"
created-date: 2026-03-27
status: completed
agent: Codex
---

## Goal

Reduce maintenance risk in the config-focused test surface, clear the current `oxlint` and `oxfmt` issues, and verify the resulting diff with targeted reviewer subagents.

## What Changed

- Fixed the current `oxlint` warnings in `src/cli/config/env.ts` and `src/cli/config/sources.ts`.
- Applied formatter-aligned cleanup in:
  - `src/cli/doctor/checks.ts`
  - `test/command-debug.test.ts`
  - `test/command-doctor.test.ts`
  - `test/command-progress.test.ts`
- Split the old config-heavy test files into smaller focused specs:
  - replaced `test/command-config.test.ts` with:
    - `test/command-config-precedence.test.ts`
    - `test/command-config-inspect.test.ts`
    - `test/command-config-path-overrides.test.ts`
    - `test/command-config-warnings.test.ts`
  - replaced `test/cli-config.test.ts` with:
    - `test/cli-config-parse.test.ts`
    - `test/cli-config-loading.test.ts`
    - `test/cli-config-user-dir.test.ts`
    - `test/cli-config-discovery.test.ts`
    - `test/cli-config-env.test.ts`
- Added `test/support/config-fixtures.ts` so repeated config-file writes stay out of the split test files.
- Updated `test/package-types.test.ts` to invoke `tsc` with `--ignoreConfig`, which is required for the current TypeScript/toolchain behavior exercised by that suite.
- Ran a final maintainability review and test review with subagents after the implementation and validation pass.

## Validation

- `bun x oxlint --tsconfig tsconfig.json src test scripts`
- `bun x oxfmt --check src test scripts package.json tsconfig.json tsconfig.test.json .oxlintrc.json .oxfmtrc.json`
- `bun test test/package-types.test.ts`
- `bun test`

## Review Outcome

- `maintainability_reviewer`: no actionable findings
- `test_reviewer`: no blocking findings
- Residual low-priority follow-ups:
  - `test/command-inspect.test.ts` remains broad and is still a good future split candidate.
  - `test/command-batch-output.test.ts` remains broad and is still a good future split candidate.
  - `test/package-types.test.ts` now intentionally depends on `tsc --ignoreConfig`, so that assumption should be revisited if TypeScript CLI behavior changes again.

## Related Plans

- `docs/plans/plan-2026-03-25-typescript-structure-modularization.md`
- `docs/plans/plan-2026-03-26-config-file-support-and-detector-defaults.md`
