---
title: "Refine word and punctuation classification"
created-date: 2026-11-26
status: draft
agent: codex
---

## Goal

Count a standalone underscore run (`___`) as one punctuation segment and zero words. Keep an underscore in `foo_bar`, an apostrophe in `they’re`, and a decimal separator in `١٫٢` inside the word returned by the locale segmenter. Apply the decision in the shared classifier so word counts, word-only character counts, and non-word collections agree on the category.

## Related Research

- [Classifying words, punctuation, symbols, and emoji](../researches/research-2026-11-26-word-and-non-word-classification.md)

## Phase 1 — Open the unified job record and reproduce the regression

- [ ] At the start of implementation, set this plan to `active` and create one `in-progress` record at `docs/plans/jobs/YYYY-MM-DD-punctuation-classifier-refinement.md` using the actual UTC start date. Link the plan and record to each other. Use that same record throughout implementation to capture the starting revision, changes by phase, commands and observed results, and any findings and their resolution. Follow the [documentation policy](../../DOCUMENTATION_POLICY.md#job-records).
- [ ] Reproduce the regression through `wordCounter` with default locale settings. For `they’re 3.14 ___ © ©️ 1️⃣ 世界。`, record the actual segment lists and counts. The `v0.2.0-canary.2` baseline counts 4 words and includes `___` in the Latin word list. With non-words enabled, the baseline and target both total 8.
- [ ] Add a failing public-API regression assertion in the [core tests](../../test/word-counter-core.test.ts) that locates `___` in the punctuation collection, and one in the [character-mode tests](../../test/word-counter-char-modes.test.ts) that expects zero word-only graphemes for `___`. Record the pre-fix failures.

## Phase 2 — Refine the classifier and verify exact categories

- [ ] In [classifyNonWordSegment](../../src/wc/non-words.ts), retain emoji and symbol precedence. For a remaining segment containing `\p{P}`, return the punctuation category when `isWordLike` is false or the segment contains no Unicode letter or number (`/[\p{L}\p{N}]/u`). Otherwise let the existing [analyzers](../../src/wc/analyze.ts) count the word-like segment. Preserve the original segment text and locale boundaries.
- [ ] Extend the public `wordCounter` tests to assert the worked input's exact lists: words `["they’re", "3.14", "世界"]`, punctuation `["___", "。"]`, symbols `["©"]`, and emoji `["©️", "1️⃣"]`. Add whole-segment regression assertions that `1️⃣2` yields exactly `["1️⃣2"]` in emoji and `aⓑc` yields exactly `["aⓑc"]` in symbols, each with zero words.
- [ ] Test classifier precedence with two inputs that contain Unicode punctuation. For `#️⃣`, expect exactly `["#️⃣"]` in emoji. For `_ⓑ_`, expect exactly `["_ⓑ_"]` in symbols. In each case assert zero words and empty lists for the other non-word categories.
- [ ] Add table-driven public-API regression tests for standalone and embedded punctuation. For Arabic `٫` / `١٫٢`, Hebrew `׳` / `ג׳`, and Japanese `゠` / `ア゠イ`, assert that the mark alone yields one punctuation entry and the embedded form yields one intact word. Assert that `foo_bar` stays one word and that underscores separated by U+0301 or U+200D retain the intervening character in a single punctuation entry.
- [ ] Cover `你好，世界。` in the same suite. Assert one Han chunk with words `["你好", "世界"]` and punctuation `["，", "。"]`. Run `bun test test/word-counter-core.test.ts test/word-counter-char-modes.test.ts` and record the results.

## Phase 3 — Validate public counting and Node.js behavior

- [ ] Check the corrected word totals across `chunk`, `segments`, and `collector`. For `___`, both `char` and `char-collector` must give a word-only total of 0. With `nonWords: true`, expect 3 non-word graphemes and one punctuation entry. Confirm the [per-locale helpers](../../src/wc/segmenter.ts) still report raw word-like segments and graphemes respectively.
- [ ] Run `bun run test:ci` to build the package and run the Bun suite. Exercise the built CLI on Node with the worked example, then with `___ --mode char --non-words --total-of punctuation --format json`. Verify `counts.words = 0`, `counts.nonWords = 3`, and `meta.totalOfOverride = 1` for the latter. Check a two-file batch containing `___` and `٫` returns a selected punctuation total of 2.
- [ ] Pipe the Markdown fixture below into the built CLI with `--detector wasm --section split --mode segments --non-words --format json`. Assert the word and punctuation lists separately for each section. The combined total is 7 before and after the fix.

  ```markdown
  ---
  title: "___"
  ---
  they’re ___
  ```

  | Section | Expected words | Expected punctuation, in source order |
  | --- | --- | --- |
  | `frontmatter` | `["title"]` | `[":", "\"", "___", "\""]` |
  | `content` | `["they’re"]` | `["___"]` |

- [ ] On Node 22.18.0 (the package minimum) and a supported Node build with a different Unicode version, import `wordCounter` from the built package. With `mode: "segments"` and `nonWords: true`, assert the sole collected entry for each input: `٫` in punctuation, `١٫٢` in words, and `#️⃣` in emoji. Check the other lists are empty.
- [ ] On those same two builds, pass each `\p{P}` code point to the built `wordCounter` alone and doubled. Expect zero word counts for every input. Record Node, ICU, Unicode, and the number of tested code points alongside the results.
- [ ] Run `bun run type-check`, `bun run lint`, `bun run format:check`, and `bun run verify:package-contents`. Record results and resolve any implementation findings before documenting the final behavior.

## Phase 4 — Documentation validation and closeout

- [ ] Update the [README non-word examples](../../README.md#non-word-collection) with `___` / `foo_bar` and `٫` / `١٫٢`. Clarify the [core API](../../README.md#core-api) helper units and explain why character mode reports three non-word graphemes for `___` while the selected punctuation total is one entry.
- [ ] Run the documented examples against the built package. Compare the printed totals, exact collected strings, and units with the README and research. Verify the plan, research, and unified job record links resolve, and that historical canary results remain clearly identified.
- [ ] Reconcile every phase checkbox with evidence in the unified job record. Once validation and findings are closed, record the final implementation revision or reviewed range and mark the plan and record `completed`.
