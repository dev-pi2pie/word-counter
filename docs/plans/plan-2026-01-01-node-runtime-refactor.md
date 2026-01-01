---
title: "Node.js runtime refactor"
date: 2026-01-01
status: completed
agent: Codex
---

## Goal
Refactor the CLI package from a Bun-first runtime to a Node.js runtime while keeping the library utilities importable. Add build/test/type-check scripts and align the package entrypoints to `dist/*` outputs.

## Current State Snapshot
- CLI entry lives in `src/bin.ts`, invoked via `bun src/bin.ts`.
- Core CLI logic is in `src/index.ts` with Bun-aware runtime helpers.
- Library exports live in `src/index.ts`, `src/wc`, and `src/utils`.
- Build tooling: `tsdown` present, no build scripts.
- Package uses `type: module`, `module: src/index.ts`, no `bin` field, and Bun-only dev dependency `@types/bun`.

## Plan
1. **Decide Node-compatible entrypoints**
   - Define `dist/index.js` (library) and `dist/bin.js` (CLI) outputs.
   - Align package.json fields: `exports`, `main`/`module`/`types`, and `bin`.
2. **Separate CLI from library**
   - Move CLI-only parsing/IO into a dedicated CLI module (e.g., `src/cli` or `src/bin.ts`).
   - Keep `src/index.ts` for library exports and minimal shared helpers.
3. **Replace Bun-specific runtime assumptions**
   - Remove `Bun` globals and `import.meta.main` logic from library exports.
   - Use Node-friendly patterns (`process.argv`, `process.stdin`, `node:` imports) in CLI entry.
4. **Build pipeline & scripts**
   - Add scripts: `build`, `type-check`, `test` (using `bun test`), and `lint/format` if expected.
   - Configure `tsdown` outputs for dual ESM/CJS plus `d.ts`.
5. **Docs & developer UX**
   - Update README with Node usage, CLI install/run, and library import examples.
   - Add a job record for the implementation when work starts.

## Risks / Open Questions
- Confirm any additional CLI UX expectations (help text, examples, defaults).

## Success Criteria
- `npm run build` outputs `dist/index.js` and `dist/bin.js`.
- `bin` entry in package.json executes correctly via `node`.
- Library imports work via `import { wordCounter } from "word-counter"`.
- Bun-only dependencies removed from runtime expectations.
