---
title: "Full dependency and toolchain refresh"
created-date: 2026-11-12
modified-date: 2026-11-12
status: active
agent: Codex
---

## Goal

Refresh Node.js security pins, JavaScript dependencies, and the Rust/WASM toolchain in six validated checkpoints. Phases 1–5 are complete; Phase 6 is in progress.

## Baseline

Reviewed November 12 against `84fb17e8b4425e651e3f6745846cbcec30820291` (`0.1.9-canary.1`):

- Type checks, lint, formatting, and workflow lint pass. Full/production npm audits are clean (124/23 packages); fresh RustSec data found no advisories or yanked crates in 28 dependencies.
- Target releases are available; declared npm/Rust minimums fit the chosen runtimes/compiler. The Cargo dry run confirms six updates and removal of `once_cell`.
- Export/type references and WASM test wiring were inspected. Fresh builds, tests, and packed-runtime validation remain implementation gates.

## Decisions

- Preserve Node.js `>=22.18.0`, TypeScript `^5 || ^6 || ^7`, Rust edition 2021, and target `wasm32-unknown-unknown`. Keep TypeScript `7.0.2`, Action references, release channels, publishing commands, and registry permissions.
- Validate the Rust compiler before changing WASM tools or crates. Keep tsdown and formatter changes in separate phases.
- Use the targets below; document any revision or deferral. Retain current `serde`, `serde-wasm-bindgen`, and `whatlang` versions and parent constraints on transitive crates.
- Node `24.22.3` bundles npm `11.19.1`, meeting [trusted-publishing requirements](https://docs.npmjs.com/trusted-publishers/) (npm `11.5.1`+, Node `22.14.0`+). Keep the bundled npm; no self-update step is needed.
- tsdown `0.23.7` retains TypeScript 7.0 support with a deprecation warning. If declaration/consumer checks fail, retain `0.23.1` and record the deferral; do not adopt a beta compiler.
- If Cargo caches are read-only, use a temporary writable `CARGO_HOME` and an explicit writable `cargo audit --db` location. Both audit and update dry-run succeeded with this workaround.

## Checkpoints and Record

- Each phase is one checkpoint. Proceed after validation and exact-range review; fix findings, rerun affected checks, and re-review widened ranges.
- Use the [unified job record](jobs/2026-11-12-full-dependency-and-toolchain-refresh.md) for phase changes, tool versions, validation, review findings, and deferrals.
- Record base/tip commit IDs or immutable patch snapshots. Preserve unrelated work and use the preceding accepted checkpoint as the rollback boundary. All six phases may auto-commit validated progress with `auto_commit_notification` advice; pushes require separate authorization.
- Keep detailed evidence in the unified record and status/checklists here. Set this plan to `active` when execution starts. Separate environment failures, local results, and live workflow results; use public-safe, repository-relative references.

## Validation Gates

**Package:** run `bun install --frozen-lockfile`, `bun run type-check`, `bun run lint`, `bun run format:check`, `bun run build`, `bun run verify:package-contents`, and `bun test`, followed by `bun audit` and `bun audit --prod`. Record test counts and unexpected skips.

**Node:** install a freshly packed artifact outside the repository. Check CLI version/help, representative count/config commands, root/detector ESM and CJS imports, and actual WASM calls through both formats. Assert the WASM engine and expected language/count output, rejecting regex fallback. Cover patched Node `22.23.5`/`24.22.3` and minimum `22.18.0` for compatibility only.

**Rust:** use the phase’s explicit tools. From `crates/language-detector`, run `cargo check --locked --target wasm32-unknown-unknown`, `cargo test --locked`, and `cargo audit --deny yanked` with fresh advisory data. Regenerate WASM and confirm the lockfile stays stable during builds/checks. The crate has no unit tests; detector regressions and Node WASM calls establish behavior.

**Workflow:** run `actionlint` on both workflows and `git diff --check`.

## Phase 1 — Node.js and JavaScript Dependencies

| Dependency/tool | Current | Target |
| --- | --- | --- |
| Node.js: CI/release preparation | `22.23.4` | `22.23.5` |
| Node.js: both publishing jobs | `24.22.1` | `24.22.3` |
| Bun: both build workflows | `1.4.3` | `1.4.4` |
| `commander` | `15.0.0` | `15.1.0` |
| `@types/bun` | `1.4.3` | `1.4.4` |
| `@types/node` | `26.6.5` | `26.6.6` |
| `oxlint` | `1.89.0` | `1.93.0` |

- [x] Update workflow pins, declared dependency bounds, and `bun.lock`; inspect incidental lockfile drift and lint diagnostics. Keep tsdown, oxfmt, TypeScript, and Rust resolutions unchanged.
- [x] Preserve npm `id-token: write`/empty `NODE_AUTH_TOKEN` and GitHub Packages token/registry configuration.
- [x] Review the committed Phase 1 range, fix findings, revalidate, and re-review before closing the phase.

**Validate:** Package, Node, and Workflow gates. Check all four Node pins and Commander option/help/config behavior; reject APIs unavailable on Node 22 despite Node 26 types. Capture this phase's fresh Rust `1.98.1` exports, payloads, warnings, and WASM size in the unified record before Phase 2.

## Phase 2 — Rust Compiler

- [x] Change Rust `1.98.1` to `1.99.1` in both workflows; retain `wasm-pack` `0.15.0`, `cargo-audit` `0.22.2`, and the crate lockfile.
- [x] Compare rebuilt exports, payloads, warnings, and WASM size with Phase 1's captured output. Rust 1.99 uses LLVM 23; investigate unexplained material changes rather than require byte equality.
- [x] Review the committed Phase 2 range and resolve findings before closure.

**Validate:** Rust, Package, Node, and Workflow gates.

## Phase 3 — Cargo Dependencies and Rust/WASM Tools

| Dependency/tool | Current | Target |
| --- | --- | --- |
| `cargo-audit` | `0.22.2` | `0.23.0` |
| `wasm-pack` | `0.15.0` | `0.15.1` |
| `wasm-bindgen` and its three companion crates | `0.2.129` | `0.2.130` |
| `js-sys` | `0.3.106` | `0.3.107` |
| `syn` | `3.0.9` | `3.0.10` |
| `once_cell` | `1.21.4` | Removed |

- [x] Update both workflow tool pins; install exact versions with `--locked`. Refresh the crate lockfile within existing manifest ranges.
- [x] Run `cargo tree --locked --target all -d` from the crate, repeat the update dry run, and verify the wasm-bindgen CLI matches the resolved crate.
- [x] Inspect regenerated JS glue, package contents, exports, and WASM sizes, including Binaryen changes.
- [x] Review the committed Phase 3 range and resolve findings before closure.

**Validate:** all gates, installed tool versions, audit exit/output compatibility, and detector language/script/confidence/reliability contracts. Isolate tool/crate changes if a combined gate fails.

## Phase 4 — tsdown and Declarations

- [x] Update `tsdown` `0.23.1` to `0.23.7`; distinguish the expected TypeScript 7.0 warning from failures.
- [x] Compare root/detector declarations and verify package export/type paths, especially `dist/esm/index2.d.mts`. Adjust configuration/references only for confirmed output changes.
- [x] Compile external packed-package fixtures with stable TypeScript 5, 6, and retained `7.0.2`, covering default/named root imports and detector APIs.
- [x] Review the committed Phase 4 range and resolve findings before closure.

**Validate:** Package and Node gates plus consumer/declaration checks. Defer an incompatible upgrade instead of widening compiler requirements.

## Phase 5 — oxfmt

- [x] Update `oxfmt` `0.74.0` to `0.78.0`, explicitly replacing the `^0.74.0` range.
- [x] Check formatting before applying changes; inspect embedded HTML/Vue effects and preserve the configured scope unless migration is required.
- [x] Review the committed Phase 5 range and resolve findings before closure.

**Validate:** apply reviewed formatting if needed, then run the Package gate. Run Node checks if source changed; confirm repeatable formatting and no semantic changes.

## Phase 6 — Integrated Validation and Closeout

- [x] Run all gates on the final graph and exact tool pins; account for remaining outdated packages, Cargo candidates, and deferrals.
- [ ] Review the committed Phase 6 range and accumulated refresh; resolve findings before closure.
- [ ] Reconcile this checklist with the unified record and obtain final documentation review.

**Complete:** close implementation/local validation after review. Track normal PR CI by revision and separately authorized release preparation by tag/revision; unrun live checks remain pending. Do not create tags, dispatch publishing workflows, or publish packages for closeout.

## Related Plans

- [October refresh](plan-2026-10-22-ci-and-dependency-security-refresh.md) — completed prior work.

## References

- [Node.js November security releases](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)
- [Node.js 22.23.5](https://nodejs.org/en/blog/release/v22.23.5) and [24.22.3](https://nodejs.org/en/blog/release/v24.22.3)
- [Node.js release metadata](https://nodejs.org/dist/index.json)
- [Rust 1.99 release notes](https://doc.rust-lang.org/releases.html#version-1990-2026-10-01) and [1.99.1 announcement](https://blog.rust-lang.org/2026/10/15/Rust-1.99.1/)
- [Commander 15.1.0](https://github.com/tj/commander.js/releases/tag/v15.1.0)
- [tsdown 0.23.5](https://github.com/rolldown/tsdown/releases/tag/v0.23.5) and [0.23.7](https://github.com/rolldown/tsdown/releases/tag/v0.23.7)
- [Oxc releases](https://github.com/oxc-project/oxc/releases)
- [wasm-pack 0.15.1](https://github.com/wasm-bindgen/wasm-pack/releases/tag/v0.15.1)
- [cargo-audit 0.23.0](https://github.com/rustsec/rustsec/releases/tag/cargo-audit/v0.23.0)
- [wasm-bindgen 0.2.130](https://github.com/wasm-bindgen/wasm-bindgen/releases/tag/0.2.130)
