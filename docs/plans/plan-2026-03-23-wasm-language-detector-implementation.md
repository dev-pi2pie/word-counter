---
title: "WASM language detector implementation"
created-date: 2026-03-23
status: draft
agent: Codex
---

## Goal

Implement an optional WASM-backed language detector for ambiguous script routes while preserving the current regex/script detector as the default behavior for both CLI and library consumers.

## Scope

- In scope:
  - Add an opt-in detector mode for ambiguous `und-Latn` and `und-Hani` chunks.
  - Keep the current regex/script detector as the default path.
  - Introduce an internal Rust crate built to WASM and loaded through a TypeScript adapter.
  - Support detector-enabled usage from both CLI and library entrypoints.
  - Define a detector remap contract document for mapping engine output into public tags and fallback behavior.
  - Update build and publish flow so generated WASM runtime artifacts are produced during build/publish and included in the published npm package.
- Out of scope:
  - Replacing the current default detector with statistical language ID.
  - Committing generated WASM artifacts to the repository.
  - Full workspace extraction such as `packages/core` and `packages/cli`.
  - Shipping more than one production detector engine in the first pass.
  - Auto-inferring `zh-Hans` vs `zh-Hant` from the detector path.

## Phase Task Items

### Phase 1 - Public Contract and Runtime Shape

- [ ] Add a detector mode contract that keeps regex/script detection as the default.
- [ ] Add CLI support for `--detector <mode>` with:
  - `regex` as the default
  - `wasm` as the opt-in route
- [ ] Keep `--detector-engine <engine>` out of the first public implementation unless a second real engine is added.
- [ ] Add detector-aware runtime option plumbing from CLI parsing into count execution.
- [ ] Define detector-facing TypeScript types for:
  - detector mode
  - detector result
  - provenance source
  - confidence and reliability fields
- [ ] Preserve the existing default library API behavior.
- [ ] Add an explicit detector-enabled library entrypoint instead of silently mutating the current sync API contract.

### Phase 2 - Internal Detector Boundary

- [ ] Add a new detector module boundary under `src/detector/`, proposed:
  - `src/detector/index.ts`
  - `src/detector/types.ts`
  - `src/detector/none.ts`
  - `src/detector/wasm.ts`
- [ ] Route detector calls only for ambiguous buckets:
  - `und-Latn`
  - `und-Hani`
- [ ] Apply the conservative threshold policy from research:
  - count script-bearing characters only
  - `und-Latn >= 24`
  - `und-Hani >= 12`
- [ ] Fall back to the original `und-*` tag when:
  - chunk length is below threshold
  - detector output is unsupported
  - detector confidence is low
  - detector reliability is false or otherwise unacceptable
- [ ] Keep the default regex/script path unchanged when detector mode is not enabled.

### Phase 3 - Rust Crate and WASM Build Flow

- [ ] Create the Rust crate at `crates/language-detector/`.
- [ ] Start with `whatlang` as the first detector engine behind the WASM route.
- [ ] Export a minimal Rust API that accepts:
  - text
  - coarse route or original ambiguous tag
  - returns normalized detector fields needed by TypeScript
- [ ] Add a build helper such as `scripts/build-wasm.mjs`.
- [ ] Build WASM artifacts with `wasm-pack --target nodejs` into `generated/wasm-language-detector/`.
- [ ] Do not commit generated WASM artifacts.
- [ ] Copy or stage the runtime files into `dist/` as part of build/publish so the root npm package ships the generated wrapper and `.wasm` artifact.
- [ ] Keep the root single-package publish model intact.

### Phase 4 - Detector Remap Contract

- [ ] Draft a detector remap schema or guide document under `docs/schemas/` or another stable docs location during implementation.
- [ ] Define how `whatlang` outputs map into public language tags used by this package.
- [ ] Define unsupported-language fallback rules back to `und-*`.
- [ ] Define low-confidence and low-reliability fallback behavior.
- [ ] Define Han-route policy explicitly:
  - allow conservative remaps such as `cmn -> zh` only when accepted by the public contract
  - do not auto-emit `zh-Hans` or `zh-Hant`
- [ ] Define JSON provenance metadata for detector-assisted assignments.

### Phase 5 - Integration, Tests, and Documentation

- [ ] Integrate detector-aware routing into the relevant locale segmentation and counting flow without regressing current behavior.
- [ ] Add library tests covering:
  - default regex behavior remains unchanged
  - detector thresholds
  - fallback to `und-*`
  - detector-enabled library entrypoint behavior
- [ ] Add CLI tests covering:
  - `--detector regex`
  - `--detector wasm`
  - invalid detector values
  - detector fallback behavior in JSON output
- [ ] Add build verification for generated runtime artifacts being present in the published package surface.
- [ ] Update `README.md` and any locale-detection docs with:
  - default regex behavior
  - `--detector <mode>`
  - detector limitations
  - fallback semantics
  - explicit note that the npm package ships one portable WASM artifact rather than per-OS detector packages

## Execution Notes

- Keep the first implementation narrow and conservative.
- Prefer a Node-based build helper over adding extra shell-helper dependencies unless implementation friction proves otherwise.
- Keep source files and generated artifacts separate:
  - source/build workspace under `crates/` and `generated/`
  - published runtime artifacts under `dist/`
- Treat the detector remap contract as a public behavior document and avoid leaking raw engine-specific identifiers into user-facing output.
- Do not broaden repository structure beyond the current root package unless the implementation later proves that package splitting is necessary.

## Validation

- `bun run build`
- `bun run type-check`
- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`

## Related Plans

- `docs/plans/plan-2026-01-02-wc-refactor-locale-research.md`

## Related Research

- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
- `docs/researches/research-2026-01-02-language-detection.md`
