---
title: "Fix JSON frontmatter escape handling"
created-date: 2026-01-15
status: completed
agent: codex
---

## Summary
- fixed JSON frontmatter parsing to respect escaped quotes and backslashes

## Rationale
The JSON frontmatter parser treated backslashes as regular characters, causing escaped quotes to prematurely close strings and break JSON detection.
