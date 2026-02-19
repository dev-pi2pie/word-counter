---
title: "Implement custom Latin hints v2"
created-date: 2026-02-18
modified-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Implement configurable Latin hint rules in API and CLI so users can tune ambiguous Latin locale detection without changing default behavior.

## Scope

- In scope:
  - Add custom Latin hint rule support to library options and locale detection.
  - Add CLI inputs for inline rules and JSON rule files.
  - Preserve deterministic precedence between custom hints, built-in hints, and existing Latin fallback hints.
  - Add regression and feature tests plus README updates.
- Out of scope:
  - Probabilistic or chunk-level language scoring.
  - Broad expansion of built-in default Latin hints beyond the existing conservative set.
  - Breaking output schema changes.

## Plan

1. Core model and locale detection
   - Add `LatinHintRule` and `latinHintRules` to public options (`src/wc/types.ts`).
   - Extend locale detection options and internals (`src/wc/locale-detect.ts`) to evaluate an effective rule set:
     - default mode: custom rules first, then built-in rules
     - no-default mode: custom rules only
   - Keep existing Latin fallback chain unchanged when no rules match:
     - `latinTagHint` > `latinLanguageHint` > `latinLocaleHint` > `und-Latn`.
2. Rule parsing and validation
   - Introduce parser/normalizer utilities for hint rules with fail-fast errors.
   - Validate rule shape:
     - `tag` is non-empty after trim
     - `pattern` compiles as a Unicode regex
     - empty pattern is rejected
     - optional guardrail for pattern length (`<= 256`).
   - Enforce deterministic matching:
     - highest `priority` first
     - then definition order.
3. CLI surface and runtime wiring
   - Add repeatable `--latin-hint <tag>=<pattern>` option in `src/cli/program/options.ts`.
   - Add `--latin-hints-file <path>` JSON loader and `--no-default-latin-hints` toggle.
   - Wire parsed rules into runtime resolution (`src/cli/runtime/types.ts`, `src/cli/runtime/options.ts`) and then into `wcOptions`.
4. Tests
   - Add/extend library tests in `test/word-counter.test.ts` for:
     - custom rule matching
     - priority and stable tie-break behavior
     - fallback preservation when no rules match
     - invalid rule rejection.
   - Add/extend CLI tests in `test/command.test.ts` for:
     - repeated `--latin-hint`
     - file plus CLI merge behavior
     - `--no-default-latin-hints`
     - malformed input failures.
5. Documentation
   - Update `README.md` usage and examples for new flags and JSON format.
   - Document precedence, defaults, and compatibility notes.

## Task Items

- [x] Implement API and locale-detect model changes.
- [x] Implement validation and deterministic rule ordering.
- [x] Implement CLI flags and JSON loading.
- [x] Add library and CLI tests.
- [x] Update README docs.
- [x] Run validation commands and finalize.

## Validation

- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-01-14-latin-ambiguous-locale.md`

## Related Research

- `docs/researches/research-2026-02-18-latin-custom-hints-v2.md`
- `docs/researches/research-2026-01-02-language-detection.md`
- `docs/researches/research-2026-01-02-word-counter-options.md`
