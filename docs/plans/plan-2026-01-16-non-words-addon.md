---
title: "Non-word segment add-on (--non-words)"
created-date: 2026-01-16
status: completed
agent: Codex
---

## Goal
Add an opt-in `--non-words` feature that collects emoji, symbols, and punctuation as separate categories while keeping the default word-only behavior driven by `Intl.Segmenter`.

## Scope
- Add a new CLI flag `--non-words` to collect all non-word categories.
- Extend `WordCounterOptions` to accept `nonWords?: boolean`.
- Extend result payloads for all `--mode` values to include optional `nonWords` data when enabled.
- Add tests to ensure default output is unchanged and new output is deterministic.
- Update README usage docs and API surface summary.

## Requirements
- Default behavior remains unchanged (words only).
- Output is concise and consistent with existing `mode` structure.
- Non-word categories are separated (emoji, symbols, punctuation).
- Uses Unicode property regexes for classification.

## Proposed Output Shape (Draft)
- `chunk` mode: each item includes `nonWords?: { emoji: string[]; symbols: string[]; punctuation: string[]; counts: { emoji: number; symbols: number; punctuation: number } }`.
- `segments` mode: add `nonWords` sibling to `segments`, same shape as above.
- `collector` mode: add `nonWords` at the top level (locale-neutral aggregate).

## Risks / Open Questions
- Some Unicode symbols may overlap with emoji presentation; emoji takes precedence.
- Ensure JSON output remains stable and backward-compatible when flag is not used.

## Related Research
- `docs/researches/research-2026-01-16-emoji-symbol-segmentation.md`
- `docs/researches/research-2026-01-02-word-counter-options.md`
