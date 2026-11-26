---
title: "Bun, npm, and Cargo dependency refresh"
created-date: 2026-11-26
status: completed
agent: Codex
---

| Area | Change or decision | Validation |
| --- | --- | --- |
| Bun workflow pins | Updated CI and release preparation from `1.4.4` to `1.4.5` for upstream security fixes. | `actionlint` passed. The frozen install passed against the pre-refresh lockfile. |
| Bun TypeScript definitions | Updated `@types/bun` and its `bun-types` resolution from `1.4.4` to `1.4.5`. | Frozen install and type-check passed with the updated lockfile. |
| Oxlint | Updated `oxlint` and all 19 platform bindings from `1.93.0` to `1.95.0`. | `bun audit`, lint, and format check passed. Verified npm registry signatures and Sigstore provenance for the wrapper and all 19 bindings. |
| `bumpalo` | Updated `3.20.3` → `3.20.4` through `wasm-bindgen-macro-support`. The patch fixes undefined behavior in concurrent allocation of zero-sized types. | Matched the downloaded crate checksum to crates.io. |
| `pin-project-lite` | Updated `0.2.17` → `0.2.18` through `futures-util`. The patch fixes a `Drop` implementation check for always-unsized types. | Matched the downloaded crate checksum to crates.io. |
| Detector Cargo lockfile | Updated two transitive dependencies. | `cargo audit --deny yanked` passed. |
| Package validation | Validated the combined refresh through the project build and test commands. | Optimized WASM build, all 390 Bun tests, and package-content verification passed. GitHub Actions runs remain pending. |
