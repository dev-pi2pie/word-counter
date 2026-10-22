---
title: "CI and dependency security refresh"
created-date: 2026-10-22
status: in-progress
agent: Codex
---

## Plan Reference

- `docs/plans/plan-2026-10-22-ci-and-dependency-security-refresh.md`

## Phase 1 — CI and Release Flow

- Started from `4f4afb4`. The first workflow checkpoint is `2e5420d`.
- Set build jobs to Node.js `22.23.4` and publish jobs to `24.22.1`. Pinned Bun `1.4.3`, Rust `1.98.1`, `wasm-pack` `0.15.0`, and Actions to resolved commit revisions.
- Added lint to pull-request CI. Kept its existing path filter after checking that no required checks or repository rulesets are configured. Root configuration-only PRs may still skip CI.
- Added type check, lint, and tests to release preparation before artifact upload. Existing publish commands and registry permissions remain in place. CI now declares `contents: read`.

| Action | Source ref | Pinned SHA |
| --- | --- | --- |
| `actions/checkout` | `v6` | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| `actions/setup-node` | `v6` | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| `actions/upload-artifact` | `v6` | `b7c566a772e6b6bfb58ed0dc250532a479d7789f` |
| `actions/download-artifact` | `v7` | `37930b1c2abaa49bbe596cd826c3c89aef350131` |
| `oven-sh/setup-bun` | `v2` | `0c5077e51419868618aeaa5fe8019c62421857d6` |
| `dtolnay/rust-toolchain` | `master` | `683b588c487a69d01f6c6ddf40f036ff682cc2c8` |
| `Swatinem/rust-cache` | `v2` | `e9d7b9f1e587218970671bac74e5511ed9506e6a` |
| `orhun/git-cliff-action` | `v4` | `a9a95522b26fe6403f7bb24031f21fb573d0f5ff` |

### Verification

- `actionlint` and `git diff --check` passed.
- With Node.js `22.23.4`, frozen install, type check, lint, build, package-content verification, and all 385 tests passed.
- The CLI version and WASM detector smoke checks passed under Node.js `22.23.4` and `24.22.1`. The CJS entry loaded under Node.js `24.22.1`.
- The first sandboxed WASM build could not write its `wasm-bindgen` cache. The unchanged build passed with normal cache access.
- Live pull-request CI and tag-release preparation have not run for this commit. Their results remain open evidence for later verification.

## Phase 2 — npm Dependencies

- Upgraded `oxfmt` to `0.74.0`, resolving `tinypool` from `2.1.0` to `2.2.0` and clearing both critical advisories. The formatter check found no file changes.
- Refreshed `yaml`, Bun and Node types, `oxlint`, and `tsdown`. Accepted `tsdown@0.23.1` after its JavaScript bundles matched the previous build and its detector declaration kept the same 48 exports.
- Adopted TypeScript `7.0.2` and widened the peer range to include 7. Updated the package-type test to locate the compiler through its exported package metadata.
- Added full `bun audit` and format checks to pull-request CI and release preparation.

### Verification

- Frozen install, full and production audits, type check, lint, format check, build, package-content check, and all 385 tests passed. `bun outdated` reports no pending packages.
- The packed package's public imports and detector types compiled with TypeScript 5.9.3, 6.0.3, and 7.0.2. CLI and WASM detector smoke checks passed on Node.js `22.23.4` and `24.22.1`.
- `actionlint` passed. `tsdown` warns that its TypeScript 7 API integration is experimental, although the build and consumer checks passed.
- The new CI gates and release preparation still need live workflow runs. The local WASM build needed normal cache access after the sandbox denied a cache write.

## Next Phases

- Phase 3: refresh and audit the Cargo lockfile, then validate the rebuilt WASM detector.
