---
title: "Address PR review findings"
date: 2026-01-15
status: completed
agent: Codex
---

## Goal
Resolve review findings from dev → main PR before merging.

## Scope
- Adjust unfenced JSON frontmatter handling to avoid false positives.
- Normalize content extraction after unfenced JSON frontmatter.
- Improve TOML parsing for triple-quoted strings with inline comments.
- Add tests that cover each fix.

## Plan
1. Fix unfenced JSON detection to only treat it as frontmatter when parsing succeeds.
2. Normalize content to avoid a leading newline after unfenced JSON extraction.
3. Update TOML frontmatter parsing to correctly handle inline comments after closing triple quotes.
4. Add or update tests for each behavior.
5. Run the test suite (or targeted tests) to validate changes.

## Review Findings
- Unfenced JSON frontmatter should fall back to content when JSON parsing fails.
- Unfenced JSON frontmatter leaves a leading newline in content.
- TOML triple-quoted strings with inline comments can be misparsed or treated as unterminated.

## Success Criteria
- New tests pass covering the three scenarios above.
- No regressions in existing markdown frontmatter parsing.
- CLI and library outputs remain consistent with existing expectations.
