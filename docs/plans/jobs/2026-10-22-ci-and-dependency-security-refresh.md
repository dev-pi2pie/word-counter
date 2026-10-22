---
title: "CI and dependency security refresh"
created-date: 2026-10-22
status: in-progress
agent: Codex
---

## Plan Reference

- `docs/plans/plan-2026-10-22-ci-and-dependency-security-refresh.md`

## Phase 1 — CI and Release Flow

- Started from `4f4afb4`. Workflow changes landed in `2e5420d`.
- Set build jobs to Node.js `22.23.4` and publish jobs to `24.22.1`. Pinned Bun `1.4.3`, Rust `1.98.1`, `wasm-pack` `0.15.0`, and Actions to resolved commit revisions.
- Added root build configuration paths and lint to pull-request CI. Kept its path filter after checking that no required checks or repository rulesets are configured.
- Added type check, lint, and tests to release preparation before artifact upload. Existing publish commands and registry permissions remain in place. CI now declares `contents: read`.

### Verification

- `actionlint` and `git diff --check` passed.
- With Node.js `22.23.4`, frozen install, type check, lint, build, package-content verification, and all 385 tests passed.
- The CLI version smoke check passed under Node.js `22.23.4` and `24.22.1`. The CJS entry loaded under Node.js `24.22.1`.
- The first sandboxed WASM build could not write its `wasm-bindgen` cache. The unchanged build passed with normal cache access.
- Live pull-request CI and tag-release preparation have not run for this commit. Their results remain open evidence for later verification.

## Next Phases

- Phase 2: refresh npm dependencies and clear the two `tinypool` advisories before publishing.
- Phase 3: refresh and audit the Cargo lockfile, then validate the rebuilt WASM detector.
