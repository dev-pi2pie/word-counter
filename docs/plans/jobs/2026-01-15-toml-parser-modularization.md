---
title: "TOML Parser Modularization"
created-date: 2026-01-15
status: completed
agent: Codex
---

## Goal
Refactor `src/markdown/toml-simple.ts` into smaller modules while keeping `parseTomlFrontmatter` behavior unchanged.

## Scope
- Extract helper functions into focused modules.
- Keep existing public API and Node.js compatibility.

## Notes
- No behavior changes intended.
