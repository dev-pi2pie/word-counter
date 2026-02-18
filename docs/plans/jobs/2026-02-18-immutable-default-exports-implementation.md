---
title: "immutable default exports implementation"
created-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Implement immutable default export hardening for mutable uppercase constants, focused on preventing runtime mutation of defaults while preserving option-based customization flows.

## Summary

- Hardened default export immutability for Latin hint rules and related mutable container constants.
- Preserved documented customization behavior via options and flags (`latinHintRules`, `useDefaultLatinHints`, CLI hint flags).
- Added regression tests that assert mutation attempts fail.
- Verified behavior with tests and type-check.

## Changes

- `src/wc/latin-hints.ts`
  - Converted `DEFAULT_LATIN_HINT_RULES` into a frozen readonly array of frozen rule objects.
- `src/wc/locale-detect.ts`
  - Updated internal typing to accept readonly Latin hint rule objects when compiling rules.
- `src/cli/path/filter.ts`
  - Converted `DEFAULT_INCLUDE_EXTENSIONS` from exported mutable `Set` to frozen readonly extension list.
  - Kept runtime behavior by continuing to construct a fresh `Set` where filtering is resolved.
- `src/cli/total-of.ts`
  - Frozen `TOTAL_OF_PARTS` tuple at runtime.
- `test/word-counter.test.ts`
  - Added coverage proving `DEFAULT_LATIN_HINT_RULES` cannot be mutated and defaults remain effective.
- `test/command.test.ts`
  - Added coverage proving `DEFAULT_INCLUDE_EXTENSIONS` and `TOTAL_OF_PARTS` cannot be mutated.

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts` (pass)
- `bun run type-check` (pass)

## Related Plans

- `docs/plans/plan-2026-02-18-immutable-default-exports.md`
- `docs/plans/plan-2026-02-18-latin-custom-hints-v2.md`

## Related Research

- `docs/research-2026-02-18-latin-custom-hints-v2.md`
