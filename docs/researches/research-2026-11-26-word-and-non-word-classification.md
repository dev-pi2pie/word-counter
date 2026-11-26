---
title: "Classifying words, punctuation, symbols, and emoji"
created-date: 2026-11-26
modified-date: 2026-11-26
status: draft
agent: codex
---

## Research question

When a locale-aware word segment contains punctuation, what should `wordCounter` count and which original text should it collect? A standalone underscore run (`___`) belongs in `nonWords.punctuation`, while the underscore in `foo_bar` belongs to the word. Issue #66 also calls for contractions and decimals to count as words and keycaps to count as emoji.[^issue]

## Settled decisions

- The package first groups text into locale chunks. Within each chunk, `Intl.Segmenter` supplies word boundaries. Its `isWordLike` flag is locale-sensitive and implementation-dependent. Unicode illustrates word extraction with contractions and decimals intact and surrounding punctuation excluded.[^locale][^intl][^unicode]
- Default counting includes words. With `nonWords: true`, the caller also gets separate emoji, symbol, and punctuation collections and a combined total. Whitespace has its own opt-in. Word-mode collections retain the source strings.[^addon][^whitespace]
- Emoji presentation takes precedence over symbols. Plain `©` is a symbol, `©️` (with U+FE0F) is an emoji, and the keycap `1️⃣` is an emoji even when the runtime marks it word-like.[^presentation][^keycap]
- Preserve each word, punctuation, symbol, or emoji segment as one complete entry for this refinement. On both `v0.1.9` and `v0.2.0-canary.2`, `1️⃣2` is one emoji entry and `aⓑc` is one symbol entry. Splitting the keycap from the trailing digit would change the combined word-mode total from 1 to 2. Such a change needs its own use case and a rule for the remaining text.
- Count `___` as zero words and collect the run as one punctuation segment. In character mode it contributes zero word graphemes and, with non-words enabled, three non-word graphemes.

## Release comparison

The table compares the available stable Git tags from `v0.0.1` through `v0.1.9` and the first two tagged 0.2 canaries. Each tag's counting source was bundled for Node and exercised through `wordCounter` with default locale settings. Node 22.23.5 and 24.22.3 gave the same results. Both used ICU 78.3 and Unicode 17.0. These are historical sources run on a common runtime.

Each classification column gives the result for each listed input individually. The last two columns use the full example below. The candidate row reports a temporary implementation of the agreed rule on the `v0.2.0-canary.2` counting source.

| Source | `they’re`, `3.14` | `___`, `٫` | `©` / `©️` | `1️⃣` | Example words | Example with non-words |
| --- | --- | --- | --- | --- | ---: | ---: |
| Stable tags through `v0.0.7` | Word | Word | Both omitted | Word | 5 | Unavailable |
| `v0.0.8`–`v0.0.9` | Word | Word | Symbol / emoji | Word | 5 | 8 |
| `v0.1.0`–`v0.1.6` | Word | Word | Symbol / emoji | Word | 5 | 8 |
| `v0.1.7`–`v0.1.9` | Punctuation | Punctuation | Symbol / emoji | Emoji | 1 | 8 |
| `v0.2.0-canary.1` and `v0.2.0-canary.2` | Word | Word | Symbol / emoji | Emoji | 4 | 8 |
| Candidate (unreleased) | Word | Punctuation | Symbol / emoji | Emoji | **3** | **8** |

The July keycap fix moved non-word classification ahead of the word-like check. This protected keycaps but also put whole segments such as `they’re` into punctuation. The 0.2 canaries restored contractions and decimals by skipping the punctuation check for all word-like segments. That also admitted `___` and standalone Arabic decimal separator `٫` as words.[^keycap][^apostrophes]

### Worked CLI example

```sh
node dist/esm/bin.mjs "they’re 3.14 ___ © ©️ 1️⃣ 世界。" -m seg -f json
```

| Output for this input | `v0.2.0-canary.2` | Candidate |
| --- | --- | --- |
| Words in the `und-Latn` chunk | `they’re`, `3.14`, `___` | `they’re`, `3.14` |
| Words in the `und-Hani` chunk | `世界` | `世界` |
| Punctuation with `--non-words` | `。` | `___`, `。` |
| Symbols with `--non-words` | `©` | `©` |
| Emoji with `--non-words` | `©️`, `1️⃣` | `©️`, `1️⃣` |

The command above returns 4 words on `v0.2.0-canary.2` and 3 with the candidate. Adding `--non-words` yields 8 in both cases. Checking the word list and the collected punctuation exposes the difference that the combined total hides.

## Implementation direction

After the existing emoji and symbol checks, a segment containing Unicode punctuation (`\p{P}`) counts as a word if `isWordLike` is true and the segment contains at least one Unicode letter or number (`/[\p{L}\p{N}]/u`). Otherwise count it as zero words and collect it as punctuation when non-word collection is enabled.[^classifier]

### Validation criteria

We tested each Unicode punctuation character twice through `wordCounter`, first on its own and then as a pair of identical characters.

| Official Node.js versions tested | ICU | Unicode | Punctuation code points tested |
| --- | --- | --- | ---: |
| 22.18.0 (package minimum) | 77.1 | 16.0 | 855 |
| 22.23.5, 24.22.3, 26.13.1[^node26] | 78.3 | 17.0 | 856 |

Across all four builds, `v0.2.0-canary.2` counted 23 standalone punctuation inputs and 34 doubled inputs as words. Both `v0.1.9` and the candidate counted zero words in both cases.

Use paired API cases to check the exact collected strings as well as totals. Include a mixed segment such as `1️⃣2` and assert the emoji collection contains exactly `["1️⃣2"]`. Consider a language-specific exception when a real input demonstrates a disagreement with an agreed expected category. Record the input, resolved locale chunk, runtime segment and `isWordLike` flag, actual category, and expected result.

| Case | Candidate result |
| --- | --- |
| `foo_bar`, `example.com`, `col·legi` | One intact word each, including its internal punctuation. |
| Arabic `٫` / `١٫٢`, Hebrew `׳` / `ג׳`, Japanese `゠` / `ア゠イ` | In each pair the standalone mark is one punctuation segment, and the text containing it is one word. |
| `ʼ` (U+02BC), `.5` | The modifier letter apostrophe counts as a word. The runtime splits `.5` into punctuation `.` and word `5`. |
| `＿＿` (fullwidth underscores), underscores separated by U+0301 or U+200D | One punctuation segment per input, including the combining mark or joiner. |
| `你好，世界。` | Words `你好`, `世界` in one Han chunk. Collect `，` and `。` separately. |
| `版本３．１４。` and `版本３。１４。` | The fullwidth decimal point keeps `３．１４` together. The ideographic full stop separates `３` and `１４`. Both inputs also count `版本`. |
| `こんにちは、世界。` and `한국어 문장` | Japanese yields `こんにちは` and `世界` across two locale chunks. Korean yields `한국어` and `문장` in one. |

### Public counting behavior

The shared analyzers determine the words reported by `chunk`, `segments`, and `collector` and the graphemes included by `char` and `char-collector`. The correction reaches `wordCounter`, `wordCounterWithDetector`, `countSections`, and `countSectionsWithDetector`, as well as CLI batch results and `--total-of` selections.[^analyze][^exports]

For `___`, the candidate CLI with `--mode char --non-words --total-of punctuation --format json` reports `counts.words = 0`, `counts.nonWords = 3`, and `meta.totalOfOverride = 1`. The first two fields count graphemes. The selected punctuation total counts the single collected segment `___`.[^totals]

The low-level helpers measure different things. On the tested runtime, `countWordsForLocale("___", "en")` returns 1 from the runtime's word-like flag, and `countCharsForLocale("___", "en")` returns 3 graphemes. The candidate keeps both helper contracts. Once the refinement ships, the README examples should pair `___` with `foo_bar` and `٫` with `١٫٢` and identify the units each helper returns.[^helpers]

## Related Plans

- [Non-word collection](../plans/archive/plan-2026-01-16-non-words-addon.md)
- [Character count mode](../plans/archive/plan-2026-01-21-character-count-mode.md)

## References

[^issue]: [Issue #66, words with internal apostrophes or decimal points](https://github.com/dev-pi2pie/word-counter/issues/66)
[^locale]: [Original language detection research](archive/research-2026-01-02-language-detection.md)
[^intl]: [ECMA-402, CreateSegmentDataObject](https://tc39.es/ecma402/#sec-createsegmentdataobject)
[^unicode]: [Unicode Standard Annex #29, Word Boundaries](https://www.unicode.org/reports/tr29/#Word_Boundaries)
[^addon]: [Original emoji and symbol segmentation research](archive/research-2026-01-16-emoji-symbol-segmentation.md)
[^whitespace]: [Whitespace and tab counting research](archive/research-2026-01-21-whitespace-tab-counting.md)
[^presentation]: [Emoji presentation and keycap classification](../plans/jobs/2026-01-16-non-word-emoji-classification.md)
[^keycap]: [July keycap correction](../plans/jobs/2026-07-02-cicd-node-security-and-compatible-deps.md)
[^apostrophes]: [Apostrophe and decimal correction](../plans/jobs/2026-11-26-count-apostrophes-and-decimals.md)
[^node26]: [Official Node.js 26.13.1 release binaries and checksums](https://nodejs.org/dist/v26.13.1/)
[^classifier]: [Non-word classifier](../../src/wc/non-words.ts)
[^analyze]: [Word and character analyzers](../../src/wc/analyze.ts)
[^totals]: [Selective CLI totals](../../src/cli/total-of.ts)
[^exports]: [Public counting APIs](../../README.md#export-summary)
[^helpers]: [Per-locale counting helpers](../../src/wc/segmenter.ts)
