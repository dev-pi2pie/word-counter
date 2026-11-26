---
title: "Punctuation classifier refinement"
created-date: 2026-11-26
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
