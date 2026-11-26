---
title: "Count word-like apostrophes and decimals"
created-date: 2026-11-26
status: completed
agent: codex
---

| Item | Result |
| --- | --- |
| Cause and fix | Both analyzers classified segments containing punctuation before checking `Intl.Segmenter` metadata. The shared classifier now skips punctuation classification for word-like segments and preserves emoji and symbol precedence. |
| Verification | Five regression cases reproduced the bug. All 390 tests, type checking, lint, formatting, and package checks passed. CLI smoke tests passed on Node 22 and 24. |
| Branch review | Reviewed the full diff against `origin/main`, including the existing canary version bump. The code, maintainability, and test coverage reviews found no actionable issues. |

[GitHub issue #66](https://github.com/dev-pi2pie/word-counter/issues/66)
