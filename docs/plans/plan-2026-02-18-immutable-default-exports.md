---
title: "Harden immutable default exports"
created-date: 2026-02-18
modified-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Eliminate mutation risk from exported default configuration constants, starting with `DEFAULT_LATIN_HINT_RULES`, without breaking documented option-based customization behavior.

## Scope

- In scope:
  - Make `DEFAULT_LATIN_HINT_RULES` runtime-immutable and type-immutable.
  - Preserve existing API/CLI customization paths (`latinHintRules`, `useDefaultLatinHints`, CLI flags).
  - Add regression tests to ensure exported defaults cannot be mutated in-place.
  - Apply the same hardening pattern to other exported mutable containers when safe and low-risk.
- Out of scope:
  - Changes to regex-flag behavior (`u`/`v`) from the second review finding.
  - New configuration channels beyond existing API/CLI surfaces.

## Plan

1. Inventory and classify exported defaults
   - Confirm all exported `DEFAULT_*` and similar uppercase constants.
   - Separate immutable primitives from mutable containers.
2. Harden Latin default hints
   - Update `src/wc/latin-hints.ts` so exported defaults are immutable at runtime.
   - Use readonly typing to prevent compile-time mutation attempts.
   - Ensure locale detection consumes defaults without depending on mutability.
3. Align similar exported containers
   - Review `DEFAULT_INCLUDE_EXTENSIONS` and `TOTAL_OF_PARTS` export patterns.
   - Convert risky container exports to immutable-safe shapes (or internalize mutable structures) while preserving external behavior.
4. Test and documentation updates
   - Add/adjust tests for mutation safety and existing customization compatibility.
   - Update README export notes only if public export contract changes materially.

## Task Items

- [x] Implement immutable export hardening for Latin default hints.
- [x] Apply consistency hardening for other mutable exported containers (if needed).
- [x] Add regression coverage for mutation attempts and compatibility behavior.
- [x] Run test and type-check validation.

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-18-latin-custom-hints-v2.md`

## Related Research

- `docs/researches/research-2026-02-18-latin-custom-hints-v2.md`
