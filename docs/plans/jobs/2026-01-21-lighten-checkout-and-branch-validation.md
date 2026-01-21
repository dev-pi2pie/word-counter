---
title: "Lighten checkout and keep tag validation reliable"
date: 2026-01-21
status: completed
agent: Codex
---

## Summary
- Switched publish workflows to `actions/checkout@v6` with shallow checkout to reduce initial fetch time.
- Added a brief checkout comment explaining that branch validation will deepen/unshallow as needed.

## Why
- Full-history checkout (`fetch-depth: 0`) adds overhead on every run.
- The branch validation step already handles unshallowing or shallow-since when needed, so the initial checkout can stay light without risking manual tag validation.

## Files Touched
- .github/workflows/publish-github-packages.yml
- .github/workflows/publish-npm-packages.yml
