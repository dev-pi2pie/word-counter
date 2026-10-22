---
title: "CI and dependency security refresh"
created-date: 2026-10-22
modified-date: 2026-10-22
status: active
agent: Codex
---

## Goal

Patch automation's Node.js versions and refresh npm and Cargo dependencies through three verified phases.

## Baseline Evidence

- CI and release preparation use Node.js `22.23.0`. The October security release patched 22.x in `22.23.4` and 24.x in `24.22.1`. Publish jobs request a floating `24`.
- `bun audit` reports two critical advisories for `tinypool@2.1.0` through development dependency `oxfmt@0.57.0`. `bun audit --prod` is clean.
- A fresh RustSec audit found no advisories in the 28 locked crates. `cargo update --dry-run` found 18 compatible updates, including a transitive `syn` major-version change.
- Release preparation omits type checks, tests, and audits.
- Bun, Rust, and the top-level `wasm-pack` version float in automation. `cargo install wasm-pack --locked` does not pin the tool's version.

Recheck advisories and versions when each phase starts.

## Scope and Decisions

- Keep the package structure, release channels, and registry publish behavior.
- Preserve `engines.node: >=22.18.0`. Changing consumer support needs a separate decision.
- Keep the completed July plan as history. This plan covers the October update.
- Resolve the known critical npm findings before publishing, or record a specific risk exception. Record reasons for deferred upgrades.

## Phase 1 — CI and Release Flow

- [x] Move CI and release jobs to patched Node.js 22 and 24 releases. Use `22.23.4` and `24.22.1` or newer patches in those lines.
- [x] Review Bun, Rust, `wasm-pack`, and Actions version drift. Choose reproducible references where useful, and check the WASM build before changing dependencies.
- [x] Review pull-request CI coverage and add lint. Check how required status checks behave when the workflow is skipped.
- [x] Configure release preparation to validate the tagged commit with type checks, build, package verification, and tests before artifact upload.
- [x] Preserve existing publish behavior and review job permissions. Record what needs a live workflow run to verify.

Phase 1 can finish with the current npm finding open. Resolve it in Phase 2 before publishing.

## Phase 2 — npm Dependencies

- [ ] Clear both `tinypool` advisories with a compatible `oxfmt` update or a narrow patched resolution. Review any formatter changes.
- [ ] Review compatible updates to `yaml`, Bun and Node types, `oxlint`, and `tsdown`. Inspect the resulting lockfile and package metadata.
- [ ] Evaluate newer `oxfmt`, `tsdown`, and TypeScript lines separately. Adopt or defer each based on formatting, build, declaration, consumer, and runtime results. Update the TypeScript peer range only if a new line is accepted.
- [ ] Validate frozen installation, type checks, lint, formatting, build, package contents, tests, and Node.js 22/24 behavior.
- [ ] Confirm clean full and production `bun audit` results. Add repeatable audit and format checks to automation where they provide a useful gate.

Phase 2 ends when the resolved graph is clean and the accepted updates pass validation. Record any deferral.

## Phase 3 — Cargo Dependencies

- [ ] Refresh `crates/language-detector/Cargo.lock` within declared ranges. Review `wasm-bindgen`, `js-sys`, and `syn` changes without expanding detector scope by default.
- [ ] Check lockfile stability and duplicate crates. Rebuild WASM and run detector, package, and native crate checks where useful.
- [ ] Audit the refreshed lockfile against current RustSec data and check for yanked crates. Decide how to repeat this check in automation, pinning audit tooling if added.

Phase 3 ends when the Rust audit and detector/package checks pass.

## Closeout and Records

- Keep this plan `draft` until work starts, `active` through all three phases, and `completed` after integrated verification.
- Create one concise job record when Phase 1 starts. Record each phase's changes, verification, deferrals, and outstanding live checks without repeating the plan.
- Finish with the updated CI flow, both audits, and the relevant Node.js and WASM regression checks.

## Related Plans

- `docs/plans/plan-2026-07-02-cicd-and-dependency-refresh.md`
- `docs/plans/plan-2026-03-24-release-workflow-consolidation.md`

## References

- [Node.js October 2026 security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Tinypool advisory GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)
- [Tinypool advisory GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)
