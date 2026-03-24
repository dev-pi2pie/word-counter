---
title: "wasm latin detector quality false positives"
created-date: 2026-03-24
modified-date: 2026-03-24
status: draft
agent: Codex
---

## Goal

Document the follow-up quality issue where `--detector wasm` can still relabel obviously English README-style text as `fr` after the Latin hint ordering fix is applied.

## Key Findings

- The ordering fix and the detector-quality issue are separate:
  - the ordering fix restores detector eligibility for ambiguous Latin in WASM mode
  - the remaining problem is detector acceptance quality on noisy Latin windows
- Current Latin acceptance policy in `src/detector/wasm.ts` accepts:
  - results that meet `LATIN_WASM_MIN_CONFIDENCE = 0.75` and `reliable = true`
  - corroborated raw + normalized results when both remap to the same tag and confidence reaches `LATIN_WASM_CORROBORATED_MIN_CONFIDENCE = 0.7`
- Current sample normalization in `src/detector/policy.ts` preserves all Latin letters and reduces everything else to spaces. This keeps markdown-like command text eligible even when the remaining lexical signal is poor.
- The public Whatlang remap in `src/detector/whatlang-map.ts` is broad for Latin routes and does not add any project-level lexical sanity checks.
- A direct raw detector sample built from README/CLI-style English tokens such as `cat how do you do grapheme aware character count ...` can return a French result from Whatlang with low confidence and `reliable = false`.
- The CLI result observed after the ordering fix is therefore consistent with:
  - detector-first routing now working correctly
  - the current acceptance policy still being too permissive for some noisy Latin windows

## Implications or Recommendations

- Do not roll back the Latin hint ordering fix. That fix is behaving correctly.
- Treat this as a detector-policy follow-up for WASM Latin quality.
- Most likely improvement areas are:
  - tighten Latin acceptance thresholds, especially the corroborated path
  - reduce eligibility or acceptance for markdown/CLI/docs-noise windows
  - add regression fixtures for English technical prose that must stay `und-Latn` or resolve to `en`, not `fr`
- Prefer conservative fallback to `und-Latn` over confident-but-wrong language projection for noisy technical text.

## Research Priorities

- Build a narrow corpus of false-positive English technical fixtures before touching thresholds.
- Compare acceptance behavior across:
  - current reliable-path thresholds
  - corroborated-path thresholds
  - stronger reliability requirements
  - technical-noise rejection heuristics
- Use the global observability research to decide how detector decision data should be surfaced during this investigation.
- Defer a dedicated implementation plan until the open questions below are answered well enough to choose one guardrail direction.

## Open Questions

- Should README-like technical English prefer staying on `und-Latn` unless confidence is very strong, even if that reduces some true-positive non-English upgrades?
- Should corroborated acceptance for Latin require `reliable = true`, not just matching raw/normalized tags?
- Should the Latin route add a token-quality gate before the detector result can be accepted?

## Related Plans

- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`

## Related Research

- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-02-17-json-output-schema-contract.md`
- `docs/researches/research-2026-03-24-global-debug-observability-model.md`
