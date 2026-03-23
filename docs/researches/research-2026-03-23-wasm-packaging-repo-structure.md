---
title: "WASM Packaging and Repo Structure for Optional Detector"
created-date: 2026-03-23
modified-date: 2026-03-23
status: draft
agent: Codex
---

## Goal

Define the lowest-risk repository and packaging shape for an internal WASM language detector without destabilizing the current single-package TypeScript layout.

## Milestone Goal

Choose a packaging direction for the WASM spike that preserves the current Node.js package contract and avoids premature multi-package release work.

## Key Findings

- The current repo publishes exactly one package from the repository root via `package.json`, `tsdown.config.ts`, `.github/workflows/publish-npm-packages.yml`, and `.github/workflows/publish-github-packages.yml`.
- The current public library path is synchronous from `src/index.ts` into `src/wc/wc.ts` and `src/wc/segment.ts`. Any WASM design that forces async initialization is a larger contract change than the file-structure refactor itself.
- The existing WASM spike in `docs/researches/research-2026-02-18-wasm-language-detector-spike.md` is about detector feasibility and routing. It is not the right place to absorb package-boundary, build, and release-process decisions.
- A `packages/cli` + `packages/core-wasm` split would require more than moving files:
  - a new workspace layout
  - separate build orchestration
  - separate publish/version decisions
  - updated release automation
  - clarified ownership between TypeScript core logic and Rust/WASM artifacts
- The proposed `core-wasm` boundary is not yet the natural domain boundary. Most of the real product logic still lives in the existing TypeScript word-counting core, not in WASM.

## Recommended Direction

- Keep the repository as a single published package for the WASM spike.
- Keep the existing `src/` layout as the main TypeScript source tree.
- Add a narrow detector boundary inside `src/` first, then attach an internal Rust/WASM implementation behind it.
- Treat Rust/WASM as an internal build artifact, not as a first-class published package in the first iteration.

## Suggested Structure

```text
.
├── package.json
├── src/
│   ├── detector/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── none.ts
│   │   └── wasm.ts
│   ├── wc/
│   └── cli/
├── crates/
│   └── language-detector/
│       ├── Cargo.toml
│       └── src/lib.rs
├── generated/
│   └── wasm-language-detector/
├── scripts/
│   └── build-wasm.mjs
└── .github/workflows/
```

## Naming Note

- Use `crates/` instead of `rust/`.
- `crates/` is the more idiomatic Rust repository convention because it names the actual packaging/build unit.
- `rust/` describes the implementation language, but this directory is intended to hold one or more Rust crates rather than general Rust-related assets.

## Why This Is Lower Risk

- It preserves the current root `package.json` publish model.
- It avoids a workspace migration before the detector value is proven.
- It lets the detector remain optional and lazily routed only for ambiguous tags.
- It limits refactor scope to a new detector seam instead of changing every current import path.
- It keeps future workspace extraction possible if the detector grows into a real product boundary.

## Internal WASM Build Approach

1. Create a Rust crate at `crates/language-detector/`.
2. Export a very small API from Rust that accepts text plus a coarse tag bucket and returns a normalized result object.
3. Build the crate with `wasm-pack --target nodejs` into `generated/wasm-language-detector/`.
4. Add a TypeScript adapter in `src/detector/wasm.ts` that loads the generated wrapper only when detector mode is enabled.
5. Keep the existing default path unchanged; only ambiguous buckets should call the detector adapter.

## NPM Distribution Model

- Cross-platform packaging is not the main concern for the current WASM direction.
- For the planned `wasm-pack --target nodejs` flow, the npm package should ship one generated JS wrapper plus one `.wasm` artifact as part of the published package contents.
- Users should install one npm package regardless of OS. This is different from native addon distribution, which often requires per-platform binaries or optional platform packages.
- The application should load the packaged local WASM artifact at runtime through the generated Node-target wrapper instead of selecting among OS-specific builds.
- The practical packaging requirement is to ensure the generated runtime files are included in the published package, either by copying them into `dist/` or by explicitly including the generated output path in `package.json`.

## API Guidance

- Do not let the WASM spike silently turn `wordCounter()` into an async API.
- Prefer dual entrypoints instead of forcing a single migration path:
  - keep the current default library API unchanged
  - add explicit detector-enabled entrypoints for both CLI and library usage
- If the generated Node-target WASM wrapper can be loaded synchronously in practice, confirm that in the spike before promising sync library support.

## When `packages/` Becomes Worth It

- Move to a workspace only when at least one of these becomes true:
  - the CLI and library need independent versioning
  - the detector must be published or consumed independently
  - Rust/WASM build steps become large enough to justify their own package lifecycle
  - test/build/release time is materially cleaner with isolated package boundaries

## Recommendation

- Draft a new research document for the packaging/refactor question instead of revising the existing WASM detector spike in place.
- Keep `docs/researches/research-2026-02-18-wasm-language-detector-spike.md` focused on detector feasibility, routing, and candidate engines.
- Use this research as the decision record for repository shape, build flow, and API-risk boundaries.

## Resolution Notes

- Generated WASM artifacts should not be committed. They should be produced during build and publish flows.
- Prefer a Node-based build helper such as `scripts/build-wasm.mjs` over adding `shx` by default.
- Add `shx` only if the implementation later needs cross-platform shell-style file operations that are materially simpler than using Node standard library calls.
- The first detector rollout should support both surfaces:
  - CLI via detector-specific options
  - library via an explicit detector-enabled entrypoint
- Do not plan a workspace extraction now. If package splitting ever becomes necessary later, reevaluate it then instead of treating it as an active design target in this phase.

## Related Plans

- `docs/plans/plan-2026-01-02-wc-refactor-locale-research.md`
- `docs/plans/plan-2026-01-01-node-runtime-refactor.md`

## Related Research

- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-01-02-language-detection.md`
