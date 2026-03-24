---
title: "wasm latin detector quality false positives"
created-date: 2026-03-24
modified-date: 2026-03-24
status: in-progress
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
- The follow-up implementation can now proceed through the combined phased plan in `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`.

## Recommended Resolution of Open Questions

- README-like technical English should prefer staying on `und-Latn` unless the Latin window clears a stronger acceptance policy than the current detector-only thresholds.
  - Confidence alone is not enough.
  - Local detector checks show command-heavy English token lists can still receive high-confidence, `reliable = true` false-positive French labels from Whatlang.
  - The safer default is to preserve `und-Latn` when the window looks more like technical noise than prose.
- Latin corroborated acceptance should stop upgrading `und-Latn` when both corroborating samples are unreliable.
  - Recommended rule: require at least one corroborating sample to report `reliable = true` before the corroborated path can accept a tag.
  - Matching raw/normalized tags by itself is too weak for a conservative contract.
- Add a narrow Latin token-quality gate before final detector acceptance.
  - This should be the primary follow-up recommendation, because threshold tuning and corroboration hardening alone do not address reliable false positives on command/list-like English windows.
  - The gate should be lightweight and explicit:
    - reject command/list-like technical windows back to `und-Latn`
    - preserve clear prose-like windows for detector acceptance
  - Validate the gate with a focused regression corpus:
    - English README/CLI/docs-noise fixtures that must remain `und-Latn` or resolve to `en`
    - known non-English Latin fixtures that should still upgrade correctly

## Scenario Comparison Matrix

The next research step should compare policy candidates against concrete scenario classes before implementing the token-quality gate.

| Scenario class | Typical example shape | Current policy risk | Corroboration hardening only | Token-quality gate target |
| --- | --- | --- | --- | --- |
| Clear English prose | sentence-heavy paragraph with normal punctuation | low | still acceptable | accept detector result when confidence/reliability are strong |
| Clear non-English Latin prose | sentence-heavy French, German, Spanish, etc. | low | still acceptable | accept detector result when confidence/reliability are strong |
| Markdown prose with light frontmatter | short frontmatter plus mostly prose body | medium | usually acceptable | allow if prose signal dominates technical framing |
| README command/list heavy English | bullets, commands, filenames, flags, short imperative phrases | high false-positive risk | reduced only for unreliable corroboration | prefer fallback to `und-Latn` unless prose signal is clearly dominant |
| CLI help or shell transcript | `--flags`, paths, commands, option descriptions | high false-positive risk | reduced only for unreliable corroboration | fallback to `und-Latn` |
| Short ambiguous English-like text | short plain text sentence | already conservative | unchanged | keep conservative fallback unless other acceptance signals are strong |

Implications from the comparison:

- corroboration hardening is necessary but not sufficient
- threshold tuning alone cannot separate prose from command/list noise
- the core missing decision is a prose-vs-technical-noise contract, not only a confidence number

## Draft Research Spec for Token-Quality Comparison

### Technical-Noise-Likely Windows

Treat a Latin detector window as technical-noise-likely when most of its visible signal comes from repository/docs mechanics rather than sentence-like prose.

Common indicators:

- dense command or flag tokens such as `--flag`, subcommands, filenames, extensions, or path fragments
- line-oriented list structure with many short fragments rather than sentence-like spans
- frontmatter keys, option labels, config keys, or repeated colon-separated labels
- lexical signal that remains weak even after normalization because the surviving Latin text is mostly nouns, commands, and labels

Expected policy direction:

- do not confidently upgrade these windows based only on detector confidence
- prefer fallback to `und-Latn`

### Clear-Prose-Likely Windows

Treat a Latin detector window as clear-prose-likely when the surviving text reads like ordinary language rather than repository mechanics.

Common indicators:

- sentence-like spans with verbs, function words, and normal clause structure
- punctuation serving sentences rather than mostly delimiters
- enough contiguous prose that normalization still leaves a coherent paragraph

Expected policy direction:

- allow current reliable-path detector acceptance
- allow corroborated acceptance only when at least one corroborating sample is reliable

### Borderline Mixed Windows

These windows contain both prose and technical framing.

Examples:

- README opening blocks with frontmatter plus one short paragraph
- documentation snippets where prose surrounds command examples
- option lists with one explanatory sentence after each flag

Expected research task:

- compare whether the first gate version should:
  - preserve detector acceptance when prose spans dominate
  - or fallback conservatively whenever command/list density crosses a simple threshold
- record this as fixture-backed behavior before implementation

## Focused Regression Corpus Draft

The next research pass should add fixture candidates in three buckets:

- Must fallback conservatively:
  - README command lists
  - CLI help blocks
  - config-like key/value docs fragments
- Must still upgrade correctly:
  - ordinary English prose
  - ordinary non-English Latin prose
  - prose-heavy markdown with light formatting noise
- Borderline cases requiring an explicit decision:
  - frontmatter plus short prose body
  - prose interleaved with shell snippets
  - bullet lists with one full sentence per item

## Approved First Fixture Matrix

Use this as the first explicit fixture-backed decision table for the token-quality gate research.

Outcome meanings:

- `accept` means the window may upgrade from `und-Latn` when the detector acceptance path is otherwise satisfied
- `fallback` means the window should stay conservative and return to `und-Latn`

| Fixture ID | Bucket | Fixture sketch | Expected outcome | Decision basis |
| --- | --- | --- | --- | --- |
| `latin-prose-en-paragraph` | clear prose | a normal English paragraph with sentence punctuation and no command/list framing | `accept` | prose signal is dominant and should remain detector-eligible |
| `latin-prose-fr-paragraph` | clear prose | a normal French paragraph with sentence punctuation and no command/list framing | `accept` | non-English Latin prose must continue to upgrade correctly |
| `latin-tech-cli-help` | clear technical noise | CLI help style block with many `--flags`, short labels, and option descriptions | `fallback` | command/list density dominates lexical signal |
| `latin-tech-readme-commands` | clear technical noise | README fragment dominated by commands, filenames, and short imperative fragments | `fallback` | technical framing dominates and false-positive risk is high |
| `latin-mixed-frontmatter-short-prose` | borderline mixed | short frontmatter block plus one short prose paragraph | `accept` | prose body should remain eligible when it clearly outweighs the framing noise |
| `latin-mixed-prose-then-command-block` | borderline mixed | one prose paragraph followed by a shell command block | `accept` | one embedded command block should not poison an otherwise prose-like window |
| `latin-mixed-bullets-with-sentences` | borderline mixed | bullet list where each bullet contains one full explanatory sentence | `accept` | sentence-bearing bullets should count as prose-like in the first policy version |
| `latin-mixed-config-heavy-with-brief-explanation` | borderline mixed | mostly config keys or colon-separated labels with one short explanatory sentence | `fallback` | technical-noise density still dominates despite the small prose presence |

## Research Outcome for Borderline Cases

The first token-quality gate should use a dominance rule, not an any-signal rejection rule.

Approved direction for the first fixture-backed version:

- accept mixed windows when prose signal clearly dominates technical framing
- fallback mixed windows when command/list/config density clearly dominates
- do not let one embedded command block force fallback for an otherwise prose-heavy window
- do not let one short explanatory sentence rescue an otherwise config/help/list-heavy window

This is intentionally conservative, but it avoids over-rejecting normal markdown prose that happens to include some technical scaffolding.

## Recommended Policy Direction

- Keep the main reliable-path rule conservative and unchanged unless corpus results show a clear need for threshold retuning.
- Harden the corroborated path first, because it currently creates an avoidable low-signal acceptance route.
- Add the Latin token-quality gate before attempting broad threshold increases.
- Accept that some borderline markdown/frontmatter-like Latin windows may fall back to `und-Latn` under the tighter policy.
  - That tradeoff is preferable to emitting confident-but-wrong language tags for technical English.
  - Users still retain explicit hint flags when deterministic relabeling is required.
- Treat the first token-quality gate as a fixture-backed contract, not a hand-wavy heuristic.
  - The comparison matrix above should be turned into tests before final policy code lands.

## Related Plans

- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`
- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`

## Related Research

- `docs/researches/research-2026-03-24-wasm-latin-tag-interaction.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`
- `docs/researches/research-2026-02-17-json-output-schema-contract.md`
- `docs/researches/research-2026-03-24-global-debug-observability-model.md`
