---
title: "Punctuation classifier refinement"
created-date: 2026-11-26
modified-date: 2026-11-26
status: in-progress
agent: codex
---

[Implementation plan](../plan-2026-11-26-punctuation-classifier-refinement.md)

## Phase 1 — Reproduce the regression

Starting revision `3a29bb7` · Bun 1.4.5 · ICU 78.1 · Unicode 17.0.

```sh
bun -e 'import wordCounter from "./src/wc";
const input = "they’re 3.14 ___ © ©️ 1️⃣ 世界。";
for (const options of [{ mode: "segments" }, { mode: "segments", nonWords: true }]) {
  console.log(JSON.stringify(wordCounter(input, options)));
}'
```

| Locale | Words | Punctuation | Symbols | Emoji |
| --- | --- | --- | --- | --- |
| `und-Latn` | `["they’re", "3.14", "___"]` | `[]` | `["©"]` | `["©️", "1️⃣"]` |
| `und-Hani` | `["世界"]` | `["。"]` | `[]` | `[]` |

The word-only total was 4. Enabling non-words gave 4 words and 4 non-words, for a total of 8.

Both focused suites run with `bun test test/word-counter-core.test.ts test/word-counter-char-modes.test.ts`.

| Run | Result |
| --- | --- |
| Before adding regressions | 22 passed, 0 failed |
| With both regression tests, before the fix | 22 passed, 2 failed |

| Assertion for `___` | Expected | Observed |
| --- | --- | --- |
| `segments` punctuation list with non-words enabled | `["___"]` | `[]` |
| `char` word-only grapheme total | `0` | `3` |

`bun run type-check`, `bun run lint`, and `bun run format:check` passed.

Test review of `3a29bb7..56193bb` reproduced both failures, verified all three checklist items, and found no coverage gaps in Phase 1.

## Phase 2 — Refine the classifier

| Checkpoint | Verification | Result |
| --- | --- | --- |
| Baseline at `75d6140` | Focused suites from Phase 1 | 22 passed, 2 failed on `___` |
| Classifier at `086f6ab` | Same suites after refining the punctuation check | 24 passed. `___` yields one punctuation entry, zero words, and zero word-only graphemes. |
| Public API regressions | Same suites with 15 added cases | 39 passed. The mixed example yields 3 words and 5 non-words. Exact entries passed for emoji, symbols, standalone and embedded punctuation, and the Han chunk. |
| Static checks | `bun run type-check`, `bun run lint`, `bun run format:check` | All passed |
| Review of `75d6140..7e9e9e6` | Classifier, public API tests, and all five checklist items | 39 focused tests passed on rerun. No material coverage gaps found. |

### Post-review follow-up

The review at `3376fd0` identified missing coverage for `"!\uFF9E"`. Added the case to the public API test table from `4ba27fc` and ran `bun test test/word-counter-core.test.ts test/word-counter-char-modes.test.ts` in both configurations.

| Classifier | Focused suites | Result for `"!\uFF9E"` |
| --- | --- | --- |
| Current | 40 passed | One intact punctuation entry, zero words |
| Temporary copy with the `!isWordLike` alternative removed | 39 passed, 1 failed | Only the new case failed. Expected `["!\uFF9E"]` in punctuation, received `[]`. |

Review of `4ba27fc..316bfce` reproduced both results and found the coverage gap resolved.

## Phase 3 — Validate public counting and Node.js behavior

`bun run test:ci` built `f504924` and passed all 407 tests. Both Node runs used that build’s package export and `dist/esm/bin.mjs`. Each sweep passed every code point matching the runtime’s `/\p{P}/u` to `wordCounter` alone and doubled.

| Node | ICU | Unicode | API | CLI | Punctuation code points | Standalone failures | Doubled failures |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| 22.23.5 | 78.3 | 17.0 | Passed | Passed | 856 | 0 | 0 |
| 24.22.3 | 78.3 | 17.0 | Passed | Passed | 856 | 0 | 0 |

- **API.** The mixed input returned 3 words and 5 non-words across all three word modes. Both character modes gave `___` zero word graphemes, three non-word graphemes, and one punctuation entry. The raw per-locale helpers returned 1 word-like segment and 3 graphemes. Each of `٫`, `١٫٢`, and `#️⃣` was the sole entry in its expected category.
- **CLI.** The mixed input matched the expected lists and totals. With `--total-of punctuation`, `___` in character mode selected 1 entry and the two-file batch selected 2. The WASM split fixture totaled 7 and matched the exact word and punctuation lists for each section in the [Phase 3 checklist](../plan-2026-11-26-punctuation-classifier-refinement.md#phase-3--validate-public-counting-and-nodejs-behavior).
- **Package checks.** `bun run type-check`, `bun run lint`, `bun run format:check`, and `bun run verify:package-contents` passed.

Review of `f504924..23fb441` reproduced the API, CLI, section, and punctuation sweep results on both builds. No material coverage gaps were found.
