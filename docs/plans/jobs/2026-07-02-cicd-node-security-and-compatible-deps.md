---
title: "CI/CD Node security and compatible dependency refresh"
created-date: 2026-07-02
modified-date: 2026-07-02
status: completed
agent: Codex
---

## Goal

Execute Phase 1 of the CI/CD and dependency refresh plan by patching repository automation to the June 2026 Node.js 22.x security release, refreshing compatible JavaScript dependencies, and making compatible Rust/WASM dependency resolution auditable.

## Plan Reference

- `docs/plans/plan-2026-07-02-cicd-and-dependency-refresh.md`

## Implementation Notes

- Updated CI and release preparation Node.js pins from `22.22.2` to `22.23.0`.
- Kept release publish jobs on Node.js `24` to preserve the existing npm trusted-publishing bootstrap rationale.
- Broadened CI pull request path filters so workflow, package metadata, lockfile, script, TypeScript config, source, crate, and test changes trigger validation.
- Refreshed semver-compatible JavaScript dependencies with `bun update`.
- Confirmed the compatible `tsdown` update clears the transitive `defu` advisory reported by `bun audit`.
- Refreshed the local Rust/WASM dependency lock state for `crates/language-detector`.
- Added a narrow `.gitignore` exception so `crates/language-detector/Cargo.lock` is tracked while other Cargo lockfiles remain ignored.
- Fixed non-word classification so keycap emoji reported as word-like by `Intl.Segmenter` are still counted as emoji, not words.

## Verification

- `bun install --frozen-lockfile` passed after rerunning outside the sandbox because Bun could not write temp files inside the sandbox.
- `bun run type-check` passed.
- `bun run build` passed after rerunning outside the sandbox because `wasm-pack` and `wasm-opt` could not complete temp/cache work inside the sandbox.
- `bun run verify:package-contents` passed.
- `bun test test/word-counter-core.test.ts` passed after the keycap emoji classification fix.
- `bun test` passed with `385` tests.
- `bun audit` passed with no vulnerabilities found.
- `cargo tree --locked` passed.
- `cargo tree --locked -d` passed with no duplicate dependency versions.
- `cargo update --dry-run --verbose` reported no remaining compatible Rust updates; `whatlang` remains at `0.16.4` with `0.18.0` available for Phase 2 validation.
- `bun outdated` reports remaining Phase 2 JavaScript lanes only: `commander@15`, `@types/node@26`, `oxfmt@0.57`, and `tsdown@0.22`.
- `bun run lint` passed after removing two unused type imports surfaced by the refreshed `oxlint`.
- `bun run format:check` passed.

## Notes

- `wasm-pack` reported that `0.15.0` is available while the local tool remains on `0.14.0`; this was not part of Phase 1 and should be handled as a separate tooling-validation decision if needed.

## Phase 2 Notes

- Accepted `tsdown@0.22.3` after type-check, build, and package-content verification.
- Accepted `commander@15.0.0` after focused CLI parsing, help, error, config, detector, inspect, and total-of compatibility tests.
- Accepted `@types/node@26.1.0` after type-checking without changing the published Node.js runtime policy.
- Accepted `oxfmt@0.57.0` after `format:check` passed without formatting churn.
- Accepted `whatlang@0.18.0` after adding the new `Lang::Cym` to `cym` detector remap and rerunning WASM detector regressions.
- `bun outdated` reported no remaining outdated packages after the Phase 2 lanes.
- `cargo update --dry-run --verbose` reported no remaining compatible Rust updates after the Phase 2 lanes.
