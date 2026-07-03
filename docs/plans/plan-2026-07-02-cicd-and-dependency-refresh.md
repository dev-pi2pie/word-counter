---
title: "CI/CD and dependency refresh"
created-date: 2026-07-02
modified-date: 2026-07-02
status: completed
agent: Codex
---

## Goal

Refresh the repository automation and dependency baselines after the June 2026 Node.js security releases while keeping routine compatible updates separate from higher-risk dependency-line upgrades.

## Scope

- In scope:
  - Patch CI and release build automation to use a Node.js 22.x version that includes the June 2026 security fixes.
  - Recheck CI trigger coverage so dependency, workflow, build-script, and Rust/WASM changes receive validation.
  - Update semver-compatible JavaScript dependencies and verify whether the current `bun audit` finding is resolved.
  - Refresh compatible Rust/WASM lockfile updates for the `crates/language-detector` crate.
  - Validate out-of-range dependency upgrades in a second phase after the security and compatible-update lane is stable.
- Out of scope:
  - Raising the published package runtime floor unless a later decision explicitly changes the support policy.
  - Changing the current Rust/WASM packaging model.
  - Replacing `whatlang` or adding another detector engine.
  - Reworking release orchestration beyond the CI trigger and runtime-pin changes needed for this refresh.

## Current Context

- The Node.js June 2026 security releases fixed high-severity issues in the supported 22.x, 24.x, and 26.x lines.
- This repository currently keeps the published runtime contract at Node.js `>=22.18.0`.
- CI and release build preparation currently pin Node.js `22.22.2`, which predates the patched 22.x release line for the June 2026 advisory.
- The npm publish jobs use Node.js `24` to keep npm trusted publishing on a compatible npm CLI line.
- `bun audit` currently reports a high advisory through `tsdown`'s transitive `defu` dependency.
- `cargo update --dry-run --verbose` reports compatible Rust/WASM updates for `wasm-bindgen`, `js-sys`, and related transitive packages, while `whatlang` has a newer `0.18.0` line outside the current compatible refresh.

## Settled Direction

- Keep the consumer-facing Node.js runtime policy at `>=22.18.0` during the first phase.
- Patch CI and release build preparation to Node.js `22.23.0`, the patched 22.x release identified by the June 2026 advisory.
- Keep publish jobs on Node.js `24` for npm CLI compatibility during Phase 1.
- Treat semver-compatible npm and Cargo lockfile refreshes as Phase 1 work.
- Handle dependency-line changes such as `commander@15`, `@types/node@26`, `oxfmt@0.57`, `tsdown@0.22`, and `whatlang@0.18` through Phase 2 validation before adoption.
- Accept Phase 2 upgrades only after focused validation confirms package API, CLI behavior, formatting/lint behavior, build behavior, and detector quality remain acceptable.
- Do not validate or adopt out-of-range dependency-line changes in Phase 1. If the compatible `tsdown` update does not clear the audit finding, record the residual advisory and make `tsdown@0.22` the first Phase 2 lane.

## Phase Task Items

### Phase 1 - Security Patch and Compatible Refresh

- [x] Update `.github/workflows/ci.yml` from Node.js `22.22.2` to Node.js `22.23.0`.
- [x] Update the release workflow `prepare` job from Node.js `22.22.2` to Node.js `22.23.0`.
- [x] Leave release publish jobs on Node.js `24` and verify the existing npm trusted-publishing rationale still applies.
- [x] Broaden CI pull request path filters so validation runs for:
  - `.github/workflows/**`
  - `package.json`
  - `bun.lock`
  - `scripts/**`
  - `tsconfig*.json`
  - `crates/**`
  - Rust lockfile and crate metadata changes
- [x] Update semver-compatible JavaScript dependencies.
- [x] Rerun `bun audit` and confirm whether the `tsdown` transitive `defu` advisory is cleared.
- [x] If `bun audit` still reports the `tsdown` transitive advisory after compatible updates, record the residual risk and move the fix attempt to Phase 2 rather than expanding Phase 1 scope.
- [x] Refresh compatible Rust/WASM lockfile updates for `crates/language-detector`.
- [x] Confirm no duplicate Rust dependency versions are introduced.
- [x] Run the focused validation suite for CI, package contents, and detector behavior.
- [x] Create one job record for the dependency refresh implementation and Phase 1 verification results.

### Phase 2 - Dependency-Line Upgrade Validation

- [x] Validate `commander@15` against CLI parsing, help text, error behavior, and compatibility tests.
- [x] Validate `@types/node@26` against TypeScript compatibility without changing the runtime support policy by accident.
- [x] Evaluate `oxfmt@0.57` formatting output before accepting broad formatting churn.
- [x] Validate `tsdown@0.22` as the first Phase 2 lane if Phase 1 compatible updates do not clear the audit finding; otherwise evaluate it only if the newer line is separately justified.
- [x] Validate `whatlang@0.18` against detector regression coverage before accepting any language-detection behavior change.
- [x] Adopt, leave pinned, or split follow-up work for each Phase 2 lane based on validation evidence.
- [x] If Phase 2 continues from the same refresh effort, append Phase 2 results to the Phase 1 job record instead of creating a second job record.

## Validation Plan

- `bun install --frozen-lockfile`
- `bun run type-check`
- `bun run build`
- `bun run verify:package-contents`
- `bun test`
- `bun audit`
- `cargo tree --locked`
- `cargo tree --locked -d`
- `cargo update --dry-run --verbose` after the lockfile refresh, to confirm only intentional packages remain behind latest

## Review Notes

- Preserve the existing distinction between CI automation patching and consumer runtime support.
- Avoid treating out-of-range dependency updates as unsafe by default; they are deliberate upgrade lanes that need validation before acceptance.
- Keep documentation and job records free of machine-specific absolute paths.

## Related Plans

- `docs/plans/plan-2026-03-24-release-workflow-consolidation.md`
- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`

## Related Research

- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
