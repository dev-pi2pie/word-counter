---
title: "CI type-check Bun test types"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Fix CI type-check failures caused by Bun test files being compiled without declared Bun type dependencies.

## What Changed

- Added `@types/bun` to `devDependencies` so clean installs include the Bun test type declarations.
- Split TypeScript validation into:
  - `tsconfig.json` for the main project with Node types only
  - `tsconfig.test.json` for `test/**/*.ts` with Bun test types enabled
- Updated the `type-check` script in `package.json` to run both configs explicitly.

## Why

- Local type-checks were passing because `@types/bun` and `bun-types` were present as extraneous packages in `node_modules`.
- GitHub Actions runs a clean `bun install --frozen-lockfile`, so the undeclared Bun test types were missing there and `tsc` failed on `import ... from "bun:test"`.
- Separating the configs keeps the published Node-target code on a narrower type surface while still type-checking the Bun-based test suite.

## Validation

- `bun run type-check`

