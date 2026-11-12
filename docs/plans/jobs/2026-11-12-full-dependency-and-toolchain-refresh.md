---
title: "Full dependency and toolchain refresh"
created-date: 2026-11-12
status: in-progress
agent: Codex
---

## Plan

[Full dependency and toolchain refresh](../plan-2026-11-12-full-dependency-and-toolchain-refresh.md). One record covers all six phases. Phase 1 is complete; Phases 2–6 are pending.

## Execution Contract

- Record changes, validation, exact commit ranges, findings, and deferrals under each phase. Keep machine details and raw reports out of this record.
- During Phase 1, use `auto_commit_notification` for checkpoint advice and auto-commit validated progress with Conventional Commit messages. Review the complete phase base..tip range after committing; fix, revalidate, and re-review any widened range before closure.
- Review evidence and checklist updates together. Future phases and unrun live workflows remain pending. Pushes are outside the current authorization.

## Phase 1 — Node.js and JavaScript Dependencies

Status: completed. Starting revision: `de146cd42abf5cb393e11c687fceb65230df78bf`. Local validation and independent committed-range review passed.

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

- Implementation commit: `ef6f985`. Independent code review of `de146cd42abf5cb393e11c687fceb65230df78bf..ef6f985` found no actionable issues in version pins, lockfile consistency, publishing configuration, or phase isolation. The reviewer inspected the committed range without rerunning validation.
- `docs_reviewer` closeout review found no material gaps; phase status, checklist, reviewed range, evidence, and pending live checks agree.
- Live PR CI and release preparation: pending; no publishing workflow was dispatched.

## Phase 2 — Rust Compiler

Status: pending.

## Phase 3 — Cargo Dependencies and Rust/WASM Tools

Status: pending.

## Phase 4 — tsdown and Declarations

Status: pending.

## Phase 5 — oxfmt

Status: pending.

## Phase 6 — Integrated Validation and Closeout

Status: pending. Live PR CI and release preparation have not run for this refresh.
