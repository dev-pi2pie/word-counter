---
title: "Handle all section mode in countSections"
created-date: 2026-01-15
status: completed
agent: codex
---

## Summary
- add a dedicated "all" branch in `countSections` to return the full-document total.
- keep sectioned output consistent for library callers.

## Rationale
- ensure callers using `section = "all"` receive a non-zero total that matches the full input count.
