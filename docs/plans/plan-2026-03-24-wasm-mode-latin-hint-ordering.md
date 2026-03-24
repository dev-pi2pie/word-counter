---
title: "WASM mode Latin hint ordering fix"
created-date: 2026-03-24
modified-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Restore detector-first behavior in `--detector wasm` mode so Latin fallback hints do not remove ambiguous Latin chunks from WASM eligibility before remap.

## Context

Current behavior allows explicit Latin fallback hints and rule-based Latin hinting to participate in pre-detector segmentation even when `--detector wasm` is selected. That changes chunk routing before detector evaluation, removes detector-derived locale outcomes such as `fr`, and can also change total word counts because final counting uses locale-specific `Intl.Segmenter` instances.

Issue linkage:

- Bug issue: `#52`
- Affected version: `v0.1.5-canary.2`

## Scope

- In scope:
  - Change WASM-mode segmentation flow so Latin hint-based language assignment does not run before ambiguous-window detection.
  - Preserve the current detector remap policy for eligible `und-Latn` and `und-Hani` windows.
  - Keep a deterministic fallback path so unresolved ambiguous Latin can still be relabeled after detector evaluation by:
    - custom Latin hint rules
    - built-in default Latin hint rules
    - explicit Latin fallback options
  - Preserve the existing explicit Latin fallback precedence `latinTagHint` > `latinLanguageHint` > `latinLocaleHint`.
  - Add regression coverage for the interaction between `--detector wasm` and Latin hint options.
  - Update user-facing docs where detector and hint behavior is described.
- Out of scope:
  - Changing regex-mode hint behavior.
  - Reworking Han fallback semantics unless required by the same bugfix path.
  - Broad detector policy retuning beyond the ordering issue.

## Proposed Decisions

- Treat all Latin hint inputs that can relabel ambiguous Latin to a non-default Latin locale as post-detector fallback inputs, not pre-detector routing inputs, when `detector = "wasm"`:
  - explicit fallback options (`latinTagHint`, `latinLanguageHint`, `latinLocaleHint`)
  - custom Latin hint rules
  - built-in default Latin hint rules
- Keep ambiguous Latin text on `und-Latn` during the initial segmentation pass in WASM mode.
- Run the existing WASM detector flow against those ambiguous windows first.
- Only after detector evaluation, reapply Latin fallback semantics to unresolved `und-Latn` output in the current order:
  - custom and built-in Latin hint rules by existing priority and order semantics
  - explicit fallback precedence `latinTagHint` > `latinLanguageHint` > `latinLocaleHint`
  - default `und-Latn` when nothing matches

## Phase Task Items

### Phase 1 - WASM Pre-Segmentation Boundary

- [x] Introduce a WASM-specific locale-detect option path that suppresses explicit and rule-based Latin hint relabeling during the initial `segmentTextByLocale()` pass.
- [x] Keep ambiguous Latin text on `und-Latn` during the initial WASM segmentation path so detector eligibility is preserved.
- [x] Keep detector window construction and accepted remap behavior unchanged for eligible `und-Latn` and `und-Hani` routes.

### Phase 2 - Post-Detector Fallback Relabeling

- [x] Add a post-detector fallback pass that relabels only unresolved `und-Latn` chunks using the existing Latin hint semantics.
- [x] Ensure custom and built-in Latin hint rules are applied after detector acceptance or rejection, not before detector routing.
- [x] Ensure explicit Latin fallback options are applied after detector acceptance or rejection, not before detector routing.
- [x] Preserve the existing explicit Latin fallback precedence `latinTagHint` > `latinLanguageHint` > `latinLocaleHint` in the WASM fallback path.

### Phase 3 - Compatibility Guards

- [x] Keep regex mode behavior unchanged.
- [x] Keep explicit Han hint behavior unchanged unless the same implementation path proves a correction is required.
- [x] Keep public output schemas and detector remap thresholds unchanged.
- [x] Keep existing Latin hint rule priority and definition-order semantics unchanged in the fallback path.

### Phase 4 - Regression Coverage

- [x] Add tests proving `--detector wasm --latin-tag en` does not suppress detector-derived locales for otherwise eligible ambiguous Latin text.
- [x] Add tests proving unresolved ambiguous Latin still respects `latinTagHint` after detector evaluation.
- [x] Add tests proving unresolved ambiguous Latin in WASM mode still preserves explicit hint precedence `latinTagHint` > `latinLanguageHint` > `latinLocaleHint`.
- [x] Add tests proving custom and built-in Latin hint rules are deferred until after detector evaluation in WASM mode.
- [x] Add a regression test for stable totals using the reported README reproduction or a narrower fixture that captures the same failure mode.

### Phase 5 - Documentation and Closure

- [x] Update README detector notes to clarify hint ordering in WASM mode.
- [x] Add a completion job record under `docs/plans/jobs/` after implementation lands.

## Compatibility Gates

- [x] `--detector regex` behavior remains unchanged.
- [x] `--latin-tag`, `--latin-language`, and `--latin-locale` remain available in the public API and CLI.
- [x] Explicit Latin hint precedence remains `latinTagHint` > `latinLanguageHint` > `latinLocaleHint`.
- [x] Existing Latin hint rule priority and definition-order semantics remain unchanged.
- [x] `--detector wasm` keeps existing remap thresholds and accepted tag mappings unless a separate change is explicitly planned.
- [x] JSON and standard output contracts remain unchanged.

## Validation

- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`

## Related Research

- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
