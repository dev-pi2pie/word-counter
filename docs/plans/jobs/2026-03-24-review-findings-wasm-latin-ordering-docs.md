---
title: "review findings wasm latin ordering docs"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Address review findings on the WASM Latin ordering research and plan docs so they accurately describe the intended change surface and preserve existing compatibility constraints.

## What Changed

- Updated `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md` to make the pre-detector interaction explicit for:
  - explicit Latin fallback hints
  - custom Latin hint rules
  - built-in default Latin hint rules
- Tightened `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md` so the proposed WASM fix now explicitly:
  - defers all Latin hint sources that can relabel ambiguous Latin before detector routing
  - preserves explicit fallback precedence `latinTagHint` > `latinLanguageHint` > `latinLocaleHint`
  - preserves existing Latin hint rule priority and definition-order semantics in the fallback path
  - adds regression coverage for those compatibility guarantees
- Kept the affected traceability sections in plain repo-relative path form to match current repository conventions.

## Validation

- Documentation review only; no code or tests were run.

## Related Plans

- [docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md](../plan-2026-03-24-wasm-mode-latin-hint-ordering.md)

## Related Research

- [docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md](../../researches/research-2026-03-24-wasm-latin-tag-interaction.md)
