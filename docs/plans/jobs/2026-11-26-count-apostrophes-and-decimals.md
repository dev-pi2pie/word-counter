---
title: "Count word-like apostrophes and decimals"
created-date: 2026-11-26
status: completed
agent: codex
---

| Item | Result |
| --- | --- |
| Cause and fix | Both analyzers classified segments containing punctuation before checking `Intl.Segmenter` metadata. The shared classifier now skips punctuation classification for word-like segments and preserves emoji and symbol precedence. |
| Verification | Five new cases failed before the fix. Afterward, all 390 tests, type checking, lint, and formatting passed. The built CLI on Node 24.22.3 returned word counts of 2, 1, and 3 for the issue inputs and 20 word-only characters for the mixed regression input. |

[GitHub issue #66](https://github.com/dev-pi2pie/word-counter/issues/66)
