---
title: "wasm mode latin hint ordering implementation"
created-date: 2026-03-24
modified-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Implement the `--detector wasm` Latin hint ordering fix so ambiguous Latin remains detector-eligible during pre-segmentation and only unresolved `und-Latn` output is relabeled by the existing Latin fallback semantics afterward.

## Scope

- Defer Latin hint-driven relabeling during the initial WASM segmentation pass.
- Reapply existing Latin fallback semantics only after detector evaluation for unresolved `und-Latn` chunks.
- Add regression coverage for explicit hints, rule-based hints, and stable totals.
- Update the plan and README as implementation milestones complete.

## What Changed

- Updated `src/detector/wasm.ts` so WASM mode now:
  - validates the original Latin hint configuration up front
  - strips Latin hints and Latin hint rules from the initial segmentation pass
  - keeps ambiguous Latin on `und-Latn` for the existing detector window flow
  - re-segments only unresolved `und-Latn` chunks with the original options after detector evaluation
- Added regression coverage in:
  - `test/word-counter.test.ts`
  - `test/command.test.ts`
- Updated `README.md` to document the detector-first ordering in WASM mode and the post-detector Latin fallback behavior.

## Validation

- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`

## Related Research

- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
