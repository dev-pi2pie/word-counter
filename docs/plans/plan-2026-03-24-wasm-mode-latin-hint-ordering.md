---
title: "WASM mode Latin hint ordering fix"
created-date: 2026-03-24
modified-date: 2026-03-24
status: draft
agent: Codex
---

## Goal

Restore detector-first behavior in `--detector wasm` mode so Latin fallback hints do not remove ambiguous Latin chunks from WASM eligibility before remap.

## Context

Current behavior allows `--latin-tag` to participate in pre-detector segmentation even when `--detector wasm` is selected. That changes chunk routing before detector evaluation, removes detector-derived locale outcomes such as `fr`, and can also change total word counts because final counting uses locale-specific `Intl.Segmenter` instances.

Issue linkage:

- Bug issue: `#52`
- Affected version: `v0.1.5-canary.2`

## Scope

- In scope:
  - Change WASM-mode segmentation flow so Latin hint-based language assignment does not run before ambiguous-window detection.
  - Preserve the current detector remap policy for eligible `und-Latn` and `und-Hani` windows.
  - Keep a deterministic fallback path so unresolved ambiguous Latin can still be relabeled by explicit Latin fallback options after detector evaluation.
  - Add regression coverage for the interaction between `--detector wasm` and Latin hint options.
  - Update user-facing docs where detector and hint behavior is described.
- Out of scope:
  - Changing regex-mode hint behavior.
  - Reworking Han fallback semantics unless required by the same bugfix path.
  - Broad detector policy retuning beyond the ordering issue.

## Proposed Decisions

- Treat explicit Latin hint options as regex-mode labeling inputs, not pre-detector routing inputs, when `detector = "wasm"`.
- Keep ambiguous Latin text on `und-Latn` during the initial segmentation pass in WASM mode.
- Run the existing WASM detector flow against those ambiguous windows first.
- Only after detector evaluation, apply explicit Latin fallback tags to unresolved `und-Latn` output.
- Preserve built-in script-specific Latin hint rules that already identify non-ambiguous language buckets from distinctive characters unless implementation review shows they must also be deferred for consistency.

## Phase Task Items

### Phase 1 - WASM Pre-Segmentation Boundary

- [ ] Introduce a WASM-specific locale-detect option path that suppresses explicit Latin fallback hints during the initial `segmentTextByLocale()` pass.
- [ ] Keep ambiguous Latin text on `und-Latn` during the initial WASM segmentation path so detector eligibility is preserved.
- [ ] Keep detector window construction and accepted remap behavior unchanged for eligible `und-Latn` and `und-Hani` routes.

### Phase 2 - Post-Detector Fallback Relabeling

- [ ] Add a post-detector fallback pass that relabels only unresolved `und-Latn` chunks using explicit Latin fallback options.
- [ ] Ensure explicit Latin fallback options are applied after detector acceptance or rejection, not before detector routing.
- [ ] Recheck whether built-in script-specific Latin hint rules should remain in pre-detector routing or also move into the fallback layer, and document the final decision in code comments or docs if needed.

### Phase 3 - Compatibility Guards

- [ ] Keep regex mode behavior unchanged.
- [ ] Keep explicit Han hint behavior unchanged unless the same implementation path proves a correction is required.
- [ ] Keep public output schemas and detector remap thresholds unchanged.

### Phase 4 - Regression Coverage

- [ ] Add tests proving `--detector wasm --latin-tag en` does not suppress detector-derived locales for otherwise eligible ambiguous Latin text.
- [ ] Add tests proving unresolved ambiguous Latin still respects `latinTagHint` after detector evaluation.
- [ ] Add a regression test for stable totals using the reported README reproduction or a narrower fixture that captures the same failure mode.

### Phase 5 - Documentation and Closure

- [ ] Update README detector notes to clarify hint ordering in WASM mode.
- [ ] Add a completion job record under `docs/plans/jobs/` after implementation lands.

## Compatibility Gates

- [ ] `--detector regex` behavior remains unchanged.
- [ ] `--latin-tag`, `--latin-language`, and `--latin-locale` remain available in the public API and CLI.
- [ ] `--detector wasm` keeps existing remap thresholds and accepted tag mappings unless a separate change is explicitly planned.
- [ ] JSON and standard output contracts remain unchanged.

## Validation

- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`

## Related Research

- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
