---
title: "v0.1.0 canary phased delivery"
created-date: 2026-02-15
modified-date: 2026-02-15
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
  - `#18` TUI progress bar for batch mode
  - `#19` selective total composition via `--total-of`
- Cross-cutting quality issue:
  - `#20` preserve backward-compatible output defaults

## Priority Order

1. Batch file counting first (`#17`).
2. TUI progress behavior second (`#18`).
3. Selective total composition third (`#19`).
4. Compatibility validation (`#20`) is required in every phase.
5. Final pre-release review for stable `v0.1.0` (`#21`).

## Phased Implementation Plan

### Phase 1 - Batch Counting Foundation (`v0.1.0-canary.0`)

- [x] Implement repeated `--path` support for multi-file counting (`#17`).
- [x] Implement batch scope flags: default `--merged` and explicit opposite `--per-file`.
- [x] Implement directory path handling with `path.mode=auto` behavior (file vs directory by metadata).
- [x] Implement recursive directory traversal default with opt-out (`--no-recursive`).
- [x] Implement default text-like include set (`.md`, `.markdown`, `.mdx`, `.mdc`, `.txt`) and binary skipping.
- [x] Implement unreadable-file continue-on-error behavior and skip reporting toggle (`--quiet-skips`).
- [x] Implement batch + `--section` contract: count sections per file internally, then aggregate section totals.
- [x] Implement mixed-input section behavior: files without frontmatter contribute content-only (frontmatter count = 0).
- [x] Add tests for multi-path aggregation, directory traversal, deterministic ordering, scope behavior (`--merged`/`--per-file`), and skip handling.
- [x] Add tests for batch + `--section` across markdown and non-markdown text files.
- [x] Compatibility gate (`#20`): verify single-input (`text`, `stdin`, single `--path`) behavior remains unchanged.
- [x] Compatibility gate (`#20`): verify `--format raw` and current `--format json` default contracts are unchanged.

### Phase 2 - Progress UX and Debug Channel (`v0.1.0-canary.1`)

- [ ] Add batch TUI progress bar auto-enabled in standard mode (`#18`).
- [ ] Add `--no-progress` opt-out and ensure single-input runs do not show progress by default.
- [ ] Ensure progress output is transient and cleared before final output.
- [ ] Ensure `raw` and `json` outputs stay clean (no progress artifacts).
- [ ] Add `--debug` design implementation with diagnostics on `stderr` only.
- [ ] Add tests for progress mode behavior (`auto`, `--no-progress`) and `stderr`/`stdout` separation.
- [ ] Compatibility gate (`#20`): verify final standard output remains concise and parse-safe for existing use cases.
- [ ] Compatibility gate (`#20`): verify no output noise is introduced in `raw`/`json` modes.

### Phase 3 - Selective Totals via `--total-of` (`v0.1.0-canary.2`)

- [ ] Add `--total-of <parts>` with canonical parts (`words`, `emoji`, `symbols`, `punctuation`, `whitespace`) (`#19`).
- [ ] Add tolerant token normalization (`symbol` -> `symbols`, `punction` -> `punctuation`).
- [ ] Implement standard output rule: show `Total-of (override: ...)` only when override differs from base total.
- [ ] Implement raw output rule: with `--total-of`, print override total only.
- [ ] Keep standard output concise (no extra precedence note lines).
- [ ] Add tests for mixed-flag behavior, override visibility rules, alias normalization, and parity across formats.
- [ ] Compatibility gate (`#20`): verify behavior is unchanged when `--total-of` is not provided.
- [ ] Compatibility gate (`#20`): verify existing consumers can continue using current defaults without migration.

### Phase 4 - Canary Hardening (Deps + README) (`v0.1.0-canary.3`)

- [ ] Upgrade targeted dependencies (`commander`, `tsdown`, `oxfmt`, `oxlint`, `@types/node`) and validate build/test workflows.
- [ ] Reorganize README with `npx @dev-pi2pie/word-counter` as first-path quick start.
- [ ] Clarify install/usage decision flow (npx vs global install vs library usage).
- [ ] Add/refresh examples for new batch/progress/`--total-of` flows.
- [ ] Compatibility gate (`#20`): verify docs and examples preserve backward-compatible defaults.

### Phase 5 - Stable Release Readiness (`v0.1.0`)

- [ ] Run final regression pass across feature and legacy paths (`#21`).
- [ ] Re-check issue closure and acceptance criteria for `#17`, `#18`, `#19`, and `#20`.
- [ ] Validate release notes and canary-to-stable changelog clarity.
- [ ] Confirm stable tag/release only after canary feedback is resolved.

## Scope Notes

- This plan does not change existing JSON default contract structure in early canary phases.
- Any schema/config-file implementation beyond current flag/env alignment remains future work unless explicitly pulled into scope.

## Related Research

- `docs/research-2026-02-13-batch-file-counting.md`
- `docs/research-2026-02-13-cli-progress-indicator.md`
- `docs/research-2026-02-13-total-combination-mode.md`
- `docs/schemas/default-config.md`

## Related Plans

None.
