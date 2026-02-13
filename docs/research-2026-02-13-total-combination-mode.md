---
title: "Total combination mode for selective counting"
created-date: 2026-02-13
modified-date: 2026-02-13
status: draft
agent: Codex
milestone: v0.1.0
---

## Goal

Design a non-breaking way to let users control how `total` is computed (for example, `words + emoji`) without forcing all non-word categories into totals.

## Milestone Goal

Deliver a `v0.1.0` canary-ready design for selective total composition with clear CLI precedence rules, predictable JSON metadata, and backward-compatible defaults.

## Key Findings

- Current behavior is all-or-nothing for non-word totals: enabling `--non-words` adds emoji, symbols, and punctuation together; `--include-whitespace` additionally adds whitespace.
- The new requirement needs subset composition such as `words + emoji` while preserving old behavior for existing commands.
- The cleanest compatibility model is additive: introduce a new selector flag and keep legacy logic unchanged when it is not provided.
- A strong precedence model reduces ambiguity:
  - `--total-of` defines `total` composition when present.
  - `--non-words` and `--include-whitespace` remain useful for breakdown collection/display.
- For standard output, noisy precedence notes are not preferred; output should stay concise.

## Proposed Direction

- Add `--total-of <parts>` where `parts` is a comma-separated list from:
  - `words`
  - `emoji`
  - `symbols`
  - `punctuation`
  - `whitespace`
- Default path (no `--total-of`) remains unchanged to avoid breaking existing usage.
- With `--total-of`, compute `total` only from selected parts, regardless of `--non-words`/`--include-whitespace`.
- If `--total-of` includes non-word parts, non-word collection should be enabled internally as needed.
- Standard output can show both:
  - base total (existing behavior label)
  - `Total-of (override: <parts>)`
- If base total and override total are equal, hide the override field to avoid redundant output.

## Implications or Recommendations

- Keep this as a canary-scoped feature first (`v0.1.0-canary.x`) to validate naming and precedence ergonomics.
- Include explicit metadata in JSON output, such as:
  - `meta.totalOf`
  - `meta.totalOfOverride`
- Add tests for:
  - Legacy behavior unchanged without `--total-of`
  - Override behavior with mixed flags
  - Alias/typo-tolerant token parsing
  - `raw`, `standard`, and `json` parity

## Decisions

- `--total-of words` behavior:
  - show both base total and override total in standard output when they differ
  - hide `Total-of (override: ...)` when the value equals the base total
  - in `--format raw`, print only the override total when `--total-of` is present
- Token tolerance:
  - accept alias/typo-tolerant forms similar to mode normalization
  - canonicalize to strict internal tokens before counting
  - examples: `symbol` -> `symbols`, `punction` -> `punctuation`
- Precedence notes:
  - do not print extra precedence note lines in standard output
  - keep output concise and rely on explicit override field when needed

## Related Plans

None.

## References

- `src/command.ts`
- `src/wc/wc.ts`
- `src/wc/types.ts`
- `docs/research-2026-01-21-whitespace-tab-counting.md`
