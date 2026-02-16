---
title: "Phase 6 dependency upgrade and Node 20 baseline"
created-date: 2026-02-16
status: completed
agent: Codex
---

## Scope

Execute Phase 6 dependency upgrades in staged order using Bun and align runtime policy to Node.js `>=20`.

## What Changed

- Assessed dependency upgrade impact/risk before execution:
  - `commander` (`14.0.2` -> `14.0.3`): low risk (patch within same major)
  - `tsdown` (`0.19.0` -> `0.20.3`): medium risk (build-pipeline behavior can shift across minor releases)
  - `@types/node` (`25.0.8` -> `25.2.3`): low risk (type-only tightening)
  - `oxfmt` and `oxlint`: low-to-medium risk (tooling/rules/format behavior only)
- Reviewed usage coupling and upgrade impact areas:
  - CLI option/parse usage in `src/command.ts` for Commander API compatibility
  - Bundler configuration in `tsdown.config.ts` and output artifact stability (`dist/*`, shebang, declarations)
- Upgraded dependencies:
  - `commander`: `^14.0.2` -> `^14.0.3`
  - `@types/node`: `^25.0.8` -> `^25.2.3`
  - `tsdown`: `^0.19.0` -> `^0.20.3`
  - `oxfmt`: `^0.24.0` -> `^0.32.0`
  - `oxlint`: `^1.39.0` -> `^1.47.0`
- Updated build target in `tsdown.config.ts` from `node18` to `node20` for ESM/CJS/bin builds.
- Added `engines.node: ">=20"` in `package.json`.
- Added explicit runtime requirement note in README Installation section.

## Validation

- `bun run build`
- `bun test`
- `bun run type-check`
- `npm ls commander tsdown oxfmt oxlint @types/node --depth=0` (post-upgrade installed-version check)
- `bunx oxlint src test` (0 warnings, 0 errors)
- `bunx oxfmt --check .` (repo has existing formatting drift across many files)

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
