---
title: "Refine word and punctuation classification"
created-date: 2026-11-26
modified-date: 2026-11-26
status: completed
agent: codex
---

## Goal

Count a standalone underscore run (`___`) as one punctuation segment and zero words. Keep an underscore in `foo_bar`, an apostrophe in `they’re`, and a decimal separator in `١٫٢` inside the word returned by the locale segmenter. Apply the decision in the shared classifier so word counts, word-only character counts, and non-word collections agree on the category.

## Related Research

- [Classifying words, punctuation, symbols, and emoji](../researches/research-2026-11-26-word-and-non-word-classification.md)

## Job Record

- [Punctuation classifier refinement](jobs/2026-11-26-punctuation-classifier-refinement.md)

## Phase 1 — Open the unified job record and reproduce the regression

- [x] At the start of implementation, set this plan to `active` and create one `in-progress` record at `docs/plans/jobs/YYYY-MM-DD-punctuation-classifier-refinement.md` using the actual UTC start date. Link the plan and record to each other. Use that same record throughout implementation to capture the starting revision, changes by phase, commands and observed results, and any findings and their resolution. Follow the [documentation policy](../../DOCUMENTATION_POLICY.md#job-records).
- [x] Reproduce the regression through `wordCounter` with default locale settings. For `they’re 3.14 ___ © ©️ 1️⃣ 世界。`, record the actual segment lists and counts. The `v0.2.0-canary.2` baseline counts 4 words and includes `___` in the Latin word list. With non-words enabled, the baseline and target both total 8.
- [x] Add a failing public-API regression assertion in the [core tests](../../test/word-counter-core.test.ts) that locates `___` in the punctuation collection, and one in the [character-mode tests](../../test/word-counter-char-modes.test.ts) that expects zero word-only graphemes for `___`. Record the pre-fix failures.

## Phase 2 — Refine the classifier and verify exact categories

- [x] In [classifyNonWordSegment](../../src/wc/non-words.ts), retain emoji and symbol precedence. For a remaining segment containing `\p{P}`, return the punctuation category when `isWordLike` is false or the segment contains no Unicode letter or number (`/[\p{L}\p{N}]/u`). Otherwise let the existing [analyzers](../../src/wc/analyze.ts) count the word-like segment. Preserve the original segment text and locale boundaries.
- [x] Extend the public `wordCounter` tests to assert the worked input's exact lists: words `["they’re", "3.14", "世界"]`, punctuation `["___", "。"]`, symbols `["©"]`, and emoji `["©️", "1️⃣"]`. Add whole-segment regression assertions that `1️⃣2` yields exactly `["1️⃣2"]` in emoji and `aⓑc` yields exactly `["aⓑc"]` in symbols, each with zero words.
- [x] Assert that `#️⃣` is one intact emoji entry and `_ⓑ_` one intact symbol entry. Each input must yield zero words and empty lists for the other non-word categories.
- [x] Add table-driven public-API regression tests for standalone and embedded punctuation. For Arabic `٫` / `١٫٢`, Hebrew `׳` / `ג׳`, and Japanese `゠` / `ア゠イ`, assert that the mark alone yields one punctuation entry and the embedded form yields one intact word. Assert that `foo_bar` stays one word and that underscores separated by U+0301 or U+200D retain the intervening character in a single punctuation entry.
- [x] Cover `你好，世界。` in the same suite. Assert one Han chunk with words `["你好", "世界"]` and punctuation `["，", "。"]`. Run `bun test test/word-counter-core.test.ts test/word-counter-char-modes.test.ts` and record the results.

### Post-review follow-up

The review at `3376fd0` identified a missing test for `"!\uFF9E"`. U+FF9E is a Unicode letter, but the segmenter marks the whole input as non-word-like.

- [x] Add `["!\uFF9E", "punctuation"]` to the [public API test table](../../test/word-counter-core.test.ts). Run the focused suites above and verify one intact punctuation entry and zero words. In a temporary copy, remove the `!isWordLike` alternative from the punctuation check and confirm the new case fails on the missing entry. Record both results and the reviewed range in the unified job record.

## Phase 3 — Validate public counting and Node.js behavior

Run the category assertions and punctuation sweep on two supported Node.js builds already available. Prefer Node 22.x for the first build. For the second, prefer a different Unicode version (`process.versions.unicode`), then a different Node major. If only one supported build is available, run both checks on it and record single-build coverage in the unified job record.

- [x] Check the corrected word totals across `chunk`, `segments`, and `collector`. For `___`, both `char` and `char-collector` must give a word-only total of 0. With `nonWords: true`, expect 3 non-word graphemes and one punctuation entry. Confirm the [per-locale helpers](../../src/wc/segmenter.ts) still report raw word-like segments and graphemes respectively.
- [x] Run `bun run test:ci` to build the package and run the Bun suite. Exercise the built CLI on Node with the worked example, then with `___ --mode char --non-words --total-of punctuation --format json`. Verify `counts.words = 0`, `counts.nonWords = 3`, and `meta.totalOfOverride = 1` for the latter. Check a two-file batch containing `___` and `٫` returns a selected punctuation total of 2.
- [x] Pipe the Markdown fixture below into the built CLI with `--detector wasm --section split --mode segments --non-words --format json`. Assert the word and punctuation lists separately for each section. The combined total is 7 before and after the fix.

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

- [x] On each selected build, call the built package’s `wordCounter` with `mode: "segments"` and `nonWords: true`. Expect `٫` in punctuation, `١٫٢` in words, and `#️⃣` in emoji. Each input must be the sole entry across all lists.
- [x] On each selected build, pass every code point matching its `/\p{P}/u` to the built `wordCounter` alone and doubled. Assert zero words for every input. In the job record, use one row per build for Node, ICU, and Unicode versions, the number of code points tested, and failure counts for each input form.
- [x] Run `bun run type-check`, `bun run lint`, `bun run format:check`, and `bun run verify:package-contents`. Record results and resolve any implementation findings before documenting the final behavior.

## Phase 4 — Documentation validation and closeout

- [x] Update the [README non-word examples](../../README.md#non-word-collection) with `___` / `foo_bar` and `٫` / `١٫٢`. Clarify the [core API](../../README.md#core-api) helper units and explain why character mode reports three non-word graphemes for `___` while the selected punctuation total is one entry.
- [x] Run the documented examples against the built package. Compare the printed totals, exact collected strings, and units with the README and research. Verify the plan, research, and unified job record links resolve, and that historical canary results remain clearly identified.
- [x] Verify every phase item against evidence in the unified job record. After validation passes and findings are resolved, record the final revision or reviewed range and mark the plan and job `completed`.
