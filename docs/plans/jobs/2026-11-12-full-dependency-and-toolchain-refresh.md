---
title: "Full dependency and toolchain refresh"
created-date: 2026-11-12
modified-date: 2026-11-12
status: in-progress
agent: Codex
---

## Plan

[Full dependency and toolchain refresh](../plan-2026-11-12-full-dependency-and-toolchain-refresh.md). One record covers all six phases. Phases 1–5 are complete; Phase 6 is in progress.

## Execution Contract

- Record changes, validation, exact commit ranges, findings, and deferrals under each phase. Keep machine details and raw reports out of this record.
- During all six phases, use `auto_commit_notification` for checkpoint advice and auto-commit validated progress with Conventional Commit messages. Review each complete phase base..tip range after committing; fix, revalidate, and re-review any widened range before closure.
- Review evidence and checklist updates together. Future phases and unrun live workflows remain pending. Pushes are outside the current authorization.

## Phase 1 — Node.js and JavaScript Dependencies

Status: completed. Starting revision: `de146cd`. Local validation and independent committed-range review passed.

### Changes

- Set CI/release preparation to Node `22.23.5`, both publishing jobs to `24.22.3`, and both Bun pins to `1.4.4`.
- Updated Commander `15.1.0`, Bun types `1.4.4`, Node types `26.6.6`, and oxlint `1.93.0`. Lockfile drift is limited to these packages, `bun-types`, and oxlint native bindings, including upstream Linux libc metadata.
- Retained tsdown `0.23.1`, oxfmt `0.74.0`, TypeScript `7.0.2`, Rust `1.98.1`, wasm-pack `0.15.0`, cargo-audit `0.22.2`, and the unchanged Cargo lockfile. Publishing permissions, authentication, registry settings, and Action references are unchanged.

### Validation

- With Node `22.23.5` and Bun `1.4.4`, frozen install, type check, lint, format check, build, package-content verification, and all 385 tests passed (1,272 assertions; no reported skips).
- Full and production npm audits passed (124/23 packages). `actionlint` and `git diff --check` passed.
- An externally installed packed package passed CLI version/help, inline/file counts, and config/environment/CLI precedence on Node `22.18.0`, `22.23.5`, and `24.22.3`. ESM and CJS root imports and actual detector WASM calls passed on each runtime; pipeline evidence confirmed engine execution with no fallback.
- The initial optimizer download failed. The unchanged build passed after supplying the same cached Binaryen `117`; optimization remained enabled. Writable isolated caches handled installation restrictions.
- The build retains the existing experimental TypeScript 7 API warning and wasm-pack update notice. No product or workflow changes were needed for these warnings.

### Compiler Comparison Baseline

Fresh release build: Rust/Cargo `1.98.1`, target `wasm32-unknown-unknown`, wasm-pack `0.15.0`, wasm-bindgen CLI/crate `0.2.129`, Binaryen `117`.

- WASM: 288,875 bytes; SHA-256 `227e24a5238f761ca357a0526ec60d43ab77e847486784671b9ac19b853ffc0d`.
- WASM exports: `memory`, `detect_language`, `__abort_handler`, `__instance_terminated`, `__wbindgen_externrefs`, `__wbindgen_malloc`, `__wbindgen_realloc`, `__wbindgen_start`.
- Input: `This sentence should clearly be detected as English for the wasm detector path.` Raw payload: `{ lang: "eng", script: "Latin", confidence: 1, reliable: true }`; remapped tag `en`, count `13`, matching ESM/CJS results on all three Node versions.
- Root runtime exports (10): `DEFAULT_LATIN_HINT_RULES`, `appendAll`, `countCharsForLocale`, `countSections`, `countWordsForLocale`, `default`, `parseMarkdown`, `segmentTextByLocale`, `showSingularOrPluralWord`, `wordCounter`.
- Detector runtime exports (16): `DEFAULT_DETECTOR_MODE`, `DEFAULT_DETECTOR_RESULT_SOURCE`, `DETECTOR_MODES`, `DETECTOR_SOURCES`, `WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE`, `assertDetectorModeImplemented`, `countSectionsWithDetector`, `createDetectorDebugSummary`, `createDetectorResult`, `inspectTextWithDetector`, `inspectTextWithRegexDetector`, `inspectTextWithWasmDetector`, `mergeDetectorDebugSummaries`, `resolveDetectorMode`, `segmentTextByLocaleWithDetector`, `wordCounterWithDetector`.

| Declaration artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `dist/esm/index.d.mts` | 4,477 | `850746cf1ea7bc1299c08b0c1b642a13b00d97b866083d4757ee1997b23aa9b0` |
| `dist/esm/index2.d.mts` | 897 | `18bdae6a82ecbe9bf6995beb8ca9c34b89467e81129102ad9c32e9d94c9b13c4` |
| `dist/esm/detector.d.mts` | 8,727 | `834ba1707197ca3406af3ff00f1b453e732db6f7e33663b70263cfaab3d23a0b` |

### Review and Live Evidence

- Implementation commit: `ef6f985`. Independent code review of `de146cd..ef6f985` found no actionable issues in version pins, lockfile consistency, publishing configuration, or phase isolation. The reviewer inspected the committed range without rerunning validation.
- `docs_reviewer` closeout review found no material gaps; phase status, checklist, reviewed range, evidence, and pending live checks agree.
- Live PR CI and release preparation: pending; no publishing workflow was dispatched.

## Phase 2 — Rust Compiler

Status: completed. Starting revision: `dad48bf`. Local validation and independent post-commit review passed.

### Changes and Validation

- Updated both workflow compiler pins to Rust `1.99.1`. Cargo lockfile, crate source/ranges, wasm-pack `0.15.0`, cargo-audit `0.22.2`, wasm-bindgen `0.2.129`, Binaryen `117`, and JavaScript resolutions are unchanged.
- With Rust/Cargo `1.99.1`, the WASM target check and native Cargo tests passed (0 Rust unit/doc tests). Fresh RustSec audit passed for 28 dependencies, with no advisories or yanked crates.
- Frozen install, type/lint/format checks, build, package verification, all 385 Bun tests (1,272 assertions), npm audits (124/23 packages), workflow lint, and diff checks passed.
- External packed-package CLI/config, ESM/CJS, and actual WASM checks passed on Node `22.18.0`, `22.23.5`, and `24.22.3`, using the same assertions as Phase 1.

### Compiler Comparison and Review

- WASM: 288,939 bytes, up 64 bytes (0.02%). Code grew 420 bytes and data shrank 356 bytes; the net change is small and behavior gates passed. SHA-256: `cc31f456c11697c3d61d0775fe86f8d3cdd16746178821aac867f47949294fc2`.
- The eight WASM exports, 10 root/16 detector runtime exports, sample payload/count, and all three declaration fingerprints match Phase 1. The existing TypeScript API warning and wasm-pack update notice remain; no new compiler warnings appeared in the package build.
- This fresh build is the comparison baseline for Phase 3. Independent code review of `dad48bf..de1c37e` found no actionable issues and confirmed compiler-only scope; validation was not rerun by the reviewer. Live workflow checks remain pending.
- `docs_reviewer` closeout review found no material gaps in Phase 2 status, checklist, reviewed range, validation, or compiler comparison.

## Phase 3 — Cargo Dependencies and Rust/WASM Tools

Status: completed. Starting revision: `b695286`. Local validation and independent post-commit review passed.

### Changes and Validation

- Updated both workflow pins to cargo-audit `0.23.0` and wasm-pack `0.15.1`; exact-version `cargo install --locked` commands passed. Rust remains `1.99.1`.
- Cargo lockfile changes match the six planned updates: wasm-bindgen and its three companion crates `0.2.130`, js-sys `0.3.107`, and syn `3.0.10`; once_cell was removed. Manifest ranges, detector source, and JavaScript resolutions are unchanged.
- The full target graph has no duplicate crate versions; a second update dry run found no remaining compatible updates. Build/check commands left the refreshed lockfile unchanged.
- WASM target check and native Cargo tests passed (0 Rust unit/doc tests). The new audit command passed against fresh RustSec data: 27 dependencies, no advisories or yanked crates.
- Frozen install, type/lint/format checks, build, package verification, all 385 Bun tests (1,272 assertions), npm audits (124/23 packages), workflow lint, and diff checks passed.
- External packed-package CLI/config, ESM/CJS, and actual WASM checks passed on Node `22.18.0`, `22.23.5`, and `24.22.3`, with no engine fallback.

### Artifact Comparison and Review

- Verified wasm-bindgen CLI `0.2.130` matches the crate, with Binaryen `130`. The optimizer download initially failed; caching that exact upstream release allowed the unchanged optimized build to pass.
- WASM: 287,373 bytes, down 1,566 bytes (0.54%) from Phase 2. SHA-256: `efb33a3d4acd66d4a1b5652c59f651c9c1dbc8f511a489cb9fe2b034a526d629`.
- All prior WASM exports remain, with `__wbindgen_free` added for generated argument-conversion cleanup. The generated glue also changes externref initialization and UTF-8 decoding; its raw WASM declaration adds the matching free signature. The internal WASM export count is now nine.
- The 10 root/16 detector runtime exports, all three public declaration fingerprints, and the Phase 1 sample payload/tag/count match Phase 2. The existing TypeScript API warning remains.
- Independent code review of `b695286..7e38472` found no actionable issues in tool pins, the lockfile refresh, phase isolation, publishing configuration, or generated cleanup export. Validation was not rerun by the reviewer. Live workflow checks remain pending.
- `docs_reviewer` closeout review found no material gaps in Phase 3 status, checklist, reviewed range, validation, or artifact comparison.

## Phase 4 — tsdown and Declarations

Status: completed. Starting revision: `1971008`. Local validation and independent post-commit review passed.

### Changes and Validation

- Updated tsdown to `0.23.7` and its lockfile subtree, including Rolldown `1.3.2` and rolldown-plugin-dts `0.30.1`. Other direct resolutions, Cargo lockfile, workflows, build configuration, and package exports are unchanged.
- Frozen install, type/lint/format checks, build, package verification, all 385 Bun tests (1,272 assertions), npm audits (121/23 packages), workflow lint, and diff checks passed.
- External packed-package consumers compiled with TypeScript `5.9.3`, `6.0.3`, and retained `7.0.2`, covering default/named root imports and detector APIs/types with strict checking and declaration checking enabled.
- Packed CLI/config, ESM/CJS, and actual WASM checks passed on Node `22.18.0`, `22.23.5`, and `24.22.3`. Batch counts also used the emitted worker pool on all three runtimes, with no fallback.

### Artifact Comparison and Review

- All export/type paths remain valid, including `dist/esm/index2.d.mts`. Declarations differ only by removed region comments: root 4,477 → 3,940 bytes, detector 8,727 → 8,287 bytes, shared declaration unchanged at 897 bytes. Type signatures and exported names are identical.
- WASM bytes/hash/exports, the 10 root/16 detector runtime exports, and sample payload/tag/count match Phase 3. The expected TypeScript 7.0 generator deprecation warning remains; no compiler requirement was widened.
- Independent code review of `1971008..311df0c` found no actionable issues in the dependency graph, phase isolation, declarations, or package configuration. The reviewer independently compared the declarations and inspected consumer/runtime evidence; validation was not rerun. Live workflow checks remain pending.
- `docs_reviewer` closeout review found no material gaps in Phase 4 status, checklist, reviewed range, validation, or declaration comparison.

## Phase 5 — oxfmt

Status: completed. Starting revision: `a269bae`. Local validation and independent post-commit review passed.

### Changes and Validation

- Replaced `^0.74.0` with `^0.78.0`. Lockfile changes are limited to oxfmt and its 19 native bindings, including upstream metadata. Other resolutions, source, formatter configuration/scope, Cargo, and workflows are unchanged.
- The initial check and repeated Package gate check passed for all 157 matched files. No formatting edits were needed; no HTML/Vue files are in the configured scope, and no embedded-content formatting changes appeared.
- Frozen install, type/lint/format checks, build, package verification, all 385 Bun tests (1,272 assertions), npm audits (121/23 packages), workflow lint, and diff checks passed.
- All 21 build-file hashes match Phase 4, including declarations, CLI/worker bundles, and WASM. Source is unchanged, so the conditional Node rerun was not needed; Phase 4's packed-runtime evidence remains the baseline.
- Independent code review of `a269bae..270c233` found no actionable code issues in the lockfile, upstream metadata, or phase isolation. The reviewer verified the artifact fingerprints; the Package gate was not rerun during review. A wording note corrected the artifact count to exclude metadata; the filtered comparison passed. Live workflow checks remain pending.
- `docs_reviewer` closeout review found no material gaps after clarifying fingerprint verification versus the Package gate rerun; phase status, checklist, reviewed range, and evidence agree.

## Phase 6 — Integrated Validation and Closeout

Status: in-progress. Starting revision: `5066898`. Integrated local validation passed; post-commit review and documentation closeout are pending.

### Final Graph and Validation

- Verified Node build pin `22.23.5`, both publishing pins `24.22.3`, Bun `1.4.4`, Rust/Cargo `1.99.1`, wasm-pack `0.15.1`, cargo-audit `0.23.0`, wasm-bindgen CLI/crate `0.2.130`, and Binaryen `130`. Publishing Node bundles npm `11.19.1`; workflows differ from `de146cd` only by the agreed version substitutions.
- Confirmed all planned JavaScript/Cargo resolutions. `bun outdated` lists no packages; the Cargo update dry run locks zero packages and the full-target graph has no duplicate versions. No planned update was deferred. TypeScript `7.0.2` and existing crate constraints remain as agreed.
- Frozen install, type/lint/format checks, fresh optimized build, package verification, all 385 Bun tests (1,272 assertions; no skips), npm audits (121/23 packages), workflow lint, and diff checks passed. Both lockfiles stayed unchanged.
- WASM target check and native Cargo tests passed (0 Rust unit/doc tests). Fresh RustSec audit passed for 27 dependencies, with no advisories or yanked crates. The build used a fresh Cargo target directory and the previously verified tool caches; the expected TypeScript 7.0 generator warning remains.
- A freshly packed external installation passed CLI/config, root/detector ESM/CJS, actual WASM, and worker-pool checks on Node `22.18.0`, `22.23.5`, and `24.22.3`, with no fallback. Strict consumers with declaration checking enabled passed on TypeScript `5.9.3`, `6.0.3`, and `7.0.2`; all export/type and CLI paths resolve.
- All 21 build-file hashes match Phase 5, excluding filesystem metadata. WASM remains 287,373 bytes with nine exports; the 10 root/16 detector runtime exports and sample payload/tag/count are unchanged. No additional code or dependency changes were needed.

### Review and Follow-ups

- Phase 6 implementation commit and independent committed-range review: pending. The accumulated refresh will also be reviewed against `de146cd`.
- Live PR CI: pending. The PR-triggered workflow lookup for `5066898` returned no runs. Record a normal PR CI result against its exact revision when available.
- Release preparation: pending; record a separately authorized run against its tag/revision. No tag was created or publishing workflow dispatched; no package was published.
