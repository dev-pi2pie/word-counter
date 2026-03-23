---
title: "phase 7 cicd follow-up"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Harden the current CI and publish workflows for the new Rust/WASM detector path and verify that packaged npm artifacts include the staged WASM runtime files.

## What Changed

- Added package-content verification script:
  - `scripts/verify-package-contents.mjs`
- Added package verification npm script:
  - `bun run verify:package-contents`
- Updated CI workflow:
  - `.github/workflows/ci.yml`
  - add Rust cache
  - keep a single validation job for now
  - verify packaged npm contents after build
- Updated publish workflows:
  - `.github/workflows/publish-npm-packages.yml`
  - `.github/workflows/publish-github-packages.yml`
  - add Rust cache
  - verify packaged npm contents before publish

## Decisions

- Keep `cargo install wasm-pack --locked` for now.
  - Add Rust caching to reduce repeated setup cost.
  - Revisit replacement only if workflow time becomes a practical problem.
- Keep a single CI validation job for now.
  - Detector-aware validation is not yet split into a separate job.
  - Current workflow complexity does not justify extra job coordination yet.
- Do not cache generated WASM outputs as workflow artifacts for now.
  - Rebuild them during normal workflow execution.
  - Cache Rust dependencies/tooling instead.
- Add package verification before publish.
  - Ensure the staged runtime files are actually present in the npm package surface.

## Validation

- `bun run build`
- `bun run verify:package-contents`
- `bun run type-check`
- `bun test test/word-counter.test.ts test/command.test.ts test/detector-interop.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`

## Related Research

- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
