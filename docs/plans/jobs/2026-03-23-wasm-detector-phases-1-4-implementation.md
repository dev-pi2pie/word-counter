---
title: "wasm detector phases 1-4 implementation"
created-date: 2026-03-23
modified-date: 2026-03-23
status: completed
agent: Codex
---

## Goal

Implement the first WASM detector delivery slice across public API, internal detector routing, Rust/WASM build scaffolding, and the detector remap contract while preserving the current regex/script detector as the default.

## What Changed

- Added the detector-specific package surface and runtime boundary:
  - `src/detector/index.ts`
  - `src/detector/index.cjs.ts`
  - `src/detector/types.ts`
  - `src/detector/none.ts`
  - `src/detector/wasm.ts`
  - `src/detector/policy.ts`
  - `src/detector/whatlang-map.ts`
  - `src/detector/whatlang-wasm.ts`
  - `src/detector/result-builder.ts`
  - `src/detector/sections.ts`
- Added detector-aware CLI and runtime plumbing:
  - `--detector <mode>` with default `regex`
  - detector mode propagation through single-input and batch paths
  - explicit detector subpath export via `@dev-pi2pie/word-counter/detector`
- Added the internal Rust crate and WASM build helper:
  - `crates/language-detector/Cargo.toml`
  - `crates/language-detector/src/lib.rs`
  - `scripts/build-wasm.mjs`
- Updated build and package surface:
  - `package.json`
  - `tsdown.config.ts`
  - `.github/workflows/publish-npm-packages.yml`
  - `.github/workflows/publish-github-packages.yml`
  - `.gitignore`
- Added the detector remap contract draft:
  - `docs/schemas/detector-remap-contract.md`
- Added or updated tests for detector surface and detector-aware routing:
  - `test/detector-interop.test.ts`
  - `test/word-counter.test.ts`
  - `test/command.test.ts`

## Current Status

- Phase 1 is implemented and validated.
- Phase 2 detector routing is implemented and validated.
- Phase 3 Rust/WASM crate and build flow are implemented and validated locally.
- Phase 4 remap contract draft is documented.
- Remaining overall plan work lives in later documentation, workflow, and follow-up validation items outside this job record.

## Validation

- `bun run type-check`
- `bun run build:wasm`
- `bun run build`
- `bun test test/word-counter.test.ts test/command.test.ts test/detector-interop.test.ts`

## Related Research

- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
- `docs/schemas/detector-remap-contract.md`

## Related Plans

- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`
