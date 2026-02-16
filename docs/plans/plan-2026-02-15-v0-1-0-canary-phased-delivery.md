---
title: "v0.1.0 canary phased delivery"
created-date: 2026-02-15
modified-date: 2026-02-16
status: active
agent: Codex
---

## Goal

Deliver `v0.1.0` through phased canary releases with clear priority ordering, explicit compatibility gates, and a final stabilization review before stable release.

## Milestone and Issue Mapping

- Milestone: `v0.1.0`
- Parent tracking issue: `#21` (final stabilization and pre-release review)
- Feature issues:
  - `#17` batch file counting
  - `#24` language-tag alignment and hint-flag migration
  - `#18` TUI progress bar for batch mode
  - `#19` selective total composition via `--total-of`
  - `#26` predictable multi-directory path resolution semantics
- Cross-cutting quality issue:
  - `#20` preserve backward-compatible output defaults

## Priority Order

1. Batch file counting first (`#17`).
2. Language-tag alignment and hint-flag aliases second (`#24`).
3. TUI progress behavior third (`#18`).
4. Large collector-merge reliability hardening fourth (stack-safe large batch aggregation).
5. Selective total composition fifth (`#19`).
6. Compatibility validation (`#20`) is required in every phase.
7. Final pre-release review for stable `v0.1.0` (`#21`).

## Phased Implementation Plan

### Phase 1 - Batch Counting Foundation (`v0.1.0-canary.0`)

- [x] Implement repeated `--path` support for multi-file counting (`#17`).
- [x] Implement batch scope flags: default `--merged` and explicit opposite `--per-file`.
- [x] Implement directory path handling with `path.mode=auto` behavior (file vs directory by metadata).
- [x] Implement recursive directory traversal default with opt-out (`--no-recursive`).
- [x] Implement default text-like include set (`.md`, `.markdown`, `.mdx`, `.mdc`, `.txt`) and binary skipping.
- [x] Implement unreadable-file continue-on-error behavior and skip reporting toggle (`--quiet-skips`).
- [x] Refactor CLI implementation into `src/cli/*` modules while preserving `src/command.ts` compatibility exports.
- [x] Add extension-filter controls for directory scans (`--include-ext`, `--exclude-ext`) with deterministic precedence.
- [x] Implement batch + `--section` contract: count sections per file internally, then aggregate section totals.
- [x] Implement mixed-input section behavior: files without frontmatter contribute content-only (frontmatter count = 0).
- [x] Add tests for multi-path aggregation, directory traversal, deterministic ordering, scope behavior (`--merged`/`--per-file`), and skip handling.
- [x] Add tests for batch + `--section` across markdown and non-markdown text files.
- [x] Compatibility gate (`#20`): verify single-input (`text`, `stdin`, single `--path`) behavior remains unchanged.
- [x] Compatibility gate (`#20`): verify `--format raw` and current `--format json` default contracts are unchanged.
- [x] Add baseline `--debug` gating for skip diagnostics: default run should not print skipped-file details; with `--debug`, print skip diagnostics to `stderr` only.

### Phase 2 - Language-Tag Alignment and Hint Flags (`v0.1.0-canary.1`, `#24`)

- [x] Use script-level Han fallback tag (`zh-Hani`) instead of forcing `zh-Hans`.
- [x] Add `--latin-language` and `--latin-tag` as preferred Latin hint flags.
- [x] Add `--han-language` and `--han-tag` for Han fallback override.
- [x] Keep `--latin-locale` for compatibility as a legacy alias.
- [x] Add tests for new hint-flag behavior and precedence.
- [x] Update README wording from locale-centric to language-tag-centric guidance.
- [x] Document future deprecation plan in breaking-change notes.
- [x] Compatibility gate (`#20`): keep existing output field names and default contracts during canary.

### Phase 3 - Progress UX and Debug Channel (`v0.1.0-canary.2`)

- [x] Add batch TUI progress bar auto-enabled in standard mode (`#18`).
- [x] Add `--no-progress` opt-out and ensure single-input runs do not show progress by default.
- [x] Ensure progress output is transient and cleared before final output.
- [x] Ensure `raw` and `json` outputs stay clean (no progress artifacts).
- [x] Extend `--debug` beyond skip diagnostics: add structured diagnostics for batch resolution/progress lifecycle (still `stderr` only, no `stdout` pollution).
- [x] Add tests for progress mode behavior (`auto`, `--no-progress`) and `stderr`/`stdout` separation.
- [x] Add `--keep-progress` opt-in to keep the final progress line visible in standard batch mode.
- [x] Compatibility gate (`#20`): verify final standard output remains concise and parse-safe for existing use cases.
- [x] Compatibility gate (`#20`): verify no output noise is introduced in `raw`/`json` modes.

### Phase 4 - Large Collector Merge Reliability (`v0.1.0-canary.3`)

- [x] Fix stack-overflow risk in large collector merges by replacing spread-based appends with safe iterative append logic.
- [x] Apply the same safe append strategy to non-word merge and batch accumulation paths that can hit large arrays.
- [x] Add regression coverage for large collector merge payloads that previously triggered `Maximum call stack size exceeded`.
- [x] Add regression coverage for large multi-markdown batches (1,091 files) in collector mode with `--non-words`.
- [x] Document collector-mode memory characteristics for very large corpora in README.
- [x] Compatibility gate (`#20`): verify totals and output contracts stay unchanged while eliminating stack-overflow failures.

### Phase 5 - Selective Totals + Batch Finalization UX/Performance (`v0.1.0-canary.4`)

#### Layer 1 - UX and Batch Finalization Performance

- [x] Add a post-count finalization progress stage so users do not see `100%` while aggregate work is still running.
- [x] Add a transient `Finalizing aggregate...` indicator in standard batch mode (`stderr` only, no `stdout` contract changes).
- [x] Optimize merged collector aggregation for `standard`/`raw` output paths by avoiding unnecessary segment-list retention and merge copies.
- [x] Add large-batch performance coverage for collector mode plus debug stage timing diagnostics (`resolve`, `load`, `count`, `finalize`).

#### Layer 2 - Selective Totals via `--total-of`

- [x] Add `--total-of <parts>` with canonical parts (`words`, `emoji`, `symbols`, `punctuation`, `whitespace`) (`#19`).
- [x] Add tolerant token normalization (`symbol` -> `symbols`, `punction` -> `punctuation`).
- [x] Implement standard output rule: show `Total-of (override: ...)` only when override differs from base total.
- [x] Implement raw output rule: with `--total-of`, print override total only.
- [x] Keep standard output concise (no extra precedence note lines).
- [x] Add tests for mixed-flag behavior, override visibility rules, alias normalization, and parity across formats.
- [x] Compatibility gate (`#20`): verify behavior is unchanged when `--total-of` is not provided.
- [x] Compatibility gate (`#20`): verify existing consumers can continue using current defaults without migration.

### Phase 6 - Canary Hardening (Deps + README + `#26` Path Resolution) (`v0.1.0-canary.5`)

- [x] Upgrade targeted dependencies (`commander`, `tsdown`, `oxfmt`, `oxlint`, `@types/node`) and validate build/test workflows.
- [x] Reorganize README with `npx @dev-pi2pie/word-counter` as first-path quick start.
- [x] Clarify install/usage decision flow (npx vs global install vs library usage).
- [x] Add/refresh examples for new batch/progress/`--total-of` flows.
- [x] Define and document a stable mixed-input resolution contract for repeated `--path` (file + directory inputs) (`#26`).
- [x] Define overlap dedupe rules when the same file is discovered from multiple input roots and keep behavior deterministic (`#26`).
- [x] Clarify and document `--include-ext`/`--exclude-ext` behavior for direct file paths versus directory scans (`#26`).
- [x] Add `--debug` diagnostics for path-resolution decisions (root expansion, filtering, dedupe) with `stderr`-only output (`#26`).
- [x] Add regression tests for multi-directory + mixed-input ordering, overlap dedupe, and filter semantics (`#26`).
- [x] Update README and CLI docs with multi-directory resolution examples and troubleshooting notes (`#26`).
- [x] Compatibility gate (`#20`): verify docs and examples preserve backward-compatible defaults.

### Phase 7 - Stable Release Readiness (`v0.1.0`)

- [ ] Run final regression pass across feature and legacy paths (`#21`).
- [ ] Re-check issue closure and acceptance criteria for `#17`, `#18`, `#19`, `#20`, `#24`, and `#26`.
- [ ] Validate release notes and canary-to-stable changelog clarity.
- [ ] Confirm stable tag/release only after canary feedback is resolved.

## Scope Notes

- This plan does not change existing JSON default contract structure in early canary phases.
- Any schema/config-file implementation beyond current flag/env alignment remains future work unless explicitly pulled into scope.

## Related Research

- `docs/research-2026-02-13-batch-file-counting.md`
- `docs/research-2026-02-13-cli-progress-indicator.md`
- `docs/research-2026-02-13-total-combination-mode.md`
- `docs/research-2026-01-02-language-detection.md`
- `docs/schemas/default-config.md`

## Related Plans

- `docs/plans/plan-2026-02-15-command-modularization-and-extension-filters.md`
