---
title: "Fix JSON frontmatter escape handling"
date: 2025-09-20
status: completed
agent: codex
---

## Summary
- fixed JSON frontmatter parsing to respect escaped quotes and backslashes

## Rationale
The JSON frontmatter parser treated backslashes as regular characters, causing escaped quotes to prematurely close strings and break JSON detection.
