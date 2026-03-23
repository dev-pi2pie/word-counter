---
title: "detector windowing refinement"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Improve detector-mode behavior for ambiguous Latin text by refining how WASM scoring samples are built and accepted before hardening the surrounding CI/CD workflow.

## What Changed

- Updated detector-mode scoring in `src/detector/wasm.ts` to evaluate ambiguous windows with:
  - raw chunk-window text
  - a normalized script-bearing sample path
- Added detector sample normalization in `src/detector/policy.ts`.
- Added a Latin corroboration acceptance rule:
  - keep the existing conservative Latin threshold at `>= 0.75` with `reliable = true`
  - additionally accept a Latin tag at `>= 0.70` when both raw and normalized samples agree on the same remapped tag
- Added regression coverage in `test/word-counter.test.ts` for:
  - long ambiguous Latin promotion
  - markdown-like Latin promotion
  - short low-confidence English-like fallback
- Updated detector docs:
  - `docs/schemas/detector-remap-contract.md`
  - `docs/locale-tag-detection-notes.md`
- Marked Phase 6 complete in `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`.

## Smoke Test Results

Command:

```bash
bun cli --detector wasm --path ./examples/test-case-multi-files-support --jobs 4
```

Observed output after refinement:

```text
Total words: 36
Locale en: 10 words
Locale en: 11 words
Locale und-Latn: 6 words
Locale und-Latn: 9 words
```

Collector view:

```bash
bun cli --detector wasm --path ./examples/test-case-multi-files-support --jobs 4 --mode collector
```

Observed output:

```text
Total words: 36
Locale en: 21 words
Locale und-Latn: 15 words
```

Per-file JSON smoke check:

```bash
bun cli --detector wasm --path ./examples/test-case-multi-files-support --jobs 4 --per-file --format json --pretty
```

Observed locale outcome:

- `examples/test-case-multi-files-support/a.md` -> `en`
- `examples/test-case-multi-files-support/b.mdx` -> `en`
- `examples/test-case-multi-files-support/c.txt` -> `und-Latn`
- `examples/test-case-multi-files-support/nested/d.markdown` -> `und-Latn`

## Threshold Decision

- Keep the base Latin acceptance policy conservative:
  - confidence `>= 0.75`
  - `reliable = true`
- Keep the base Han acceptance policy conservative:
  - confidence `>= 0.90`
  - `reliable = true`
- Add the corroborated Latin path at confidence `>= 0.70` only when raw and normalized samples agree on the same remapped tag.

## Validation

- `bun run build`
- `bun run type-check`
- `bun test test/word-counter.test.ts`
- `bun test test/word-counter.test.ts test/command.test.ts test/detector-interop.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`

## Related Research

- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
- `docs/schemas/detector-remap-contract.md`
