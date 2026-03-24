---
title: "WASM Latin detector quality guardrails"
created-date: 2026-03-24
status: draft
agent: Codex
---

## Goal

Reduce false-positive WASM language projections for ambiguous Latin technical text such as markdown, CLI documentation, and code-adjacent prose while keeping the Latin hint ordering fix intact.

## Context

After the WASM Latin hint ordering fix, detector-derived locales correctly reappear for ambiguous Latin text. However, noisy English technical text can still be promoted to incorrect Latin languages such as `fr` under the current Whatlang acceptance policy.

## Scope

- In scope:
  - tighten WASM Latin detector acceptance so low-signal technical text is less likely to be projected to the wrong language
  - add observability for detector decisions in tests or debug output
  - add regression coverage for README-like technical English and similar noisy ambiguous Latin samples
  - preserve the existing detector-first ordering fix in WASM mode
- Out of scope:
  - replacing the WASM engine
  - changing default `--detector regex` behavior
  - broad language-detection redesign outside the WASM Latin route

## Proposed Decisions

- Keep the current detector routing shape, but make Latin acceptance more conservative.
- Evaluate candidate guardrails in this order:
  - raise corroborated Latin acceptance thresholds
  - require stronger reliability constraints for corroborated Latin acceptance
  - add a low-signal/noisy-window rejection gate for markdown/CLI-heavy text
  - prefer fallback to `und-Latn` when detector evidence is mixed
- Add detector-decision visibility so tuning does not depend on manual reverse-engineering from final locale output alone.

## Phase Task Items

### Phase 1 - Fixture and Observability

- [ ] Add narrow regression fixtures for README-like English technical text that currently misclassifies as `fr`.
- [ ] Add a way to inspect detector decisions during tests or debug flows:
  - raw detector result
  - normalized detector result
  - confidence
  - reliability
  - final acceptance reason

### Phase 2 - Policy Tuning

- [ ] Re-evaluate `LATIN_WASM_MIN_CONFIDENCE` and `LATIN_WASM_CORROBORATED_MIN_CONFIDENCE` against the new false-positive fixtures.
- [ ] Test whether corroborated Latin acceptance should require `reliable = true`.
- [ ] Test whether technical/noisy Latin windows should remain `und-Latn` unless confidence is materially stronger than today.

### Phase 3 - Heuristic Guardrails

- [ ] Evaluate adding a lightweight technical-noise guard before accepting a Latin detector result:
  - markdown punctuation density
  - command/flag density
  - unusually short repeated tokens
  - low alphabetic diversity or low stopword coherence
- [ ] Keep any added heuristic conservative and easy to explain.

### Phase 4 - Regression Coverage and Documentation

- [ ] Add regression tests proving English technical prose does not regress to `fr` under `--detector wasm`.
- [ ] Add tests proving true-positive longer non-English Latin samples still resolve when evidence remains strong.
- [ ] Update README or detector notes if acceptance policy semantics materially change.

## Compatibility Gates

- [ ] The completed WASM Latin hint ordering fix remains intact.
- [ ] `--detector regex` behavior remains unchanged.
- [ ] Unsupported or low-confidence Latin windows continue to fall back safely to `und-Latn`.
- [ ] Existing public CLI and library options remain unchanged unless a separate observability flag is explicitly planned.

## Validation

- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`

## Related Research

- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
