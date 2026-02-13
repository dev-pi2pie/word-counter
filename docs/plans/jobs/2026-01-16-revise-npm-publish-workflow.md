---
title: "Revise npm publish workflow for trusted publishing"
created-date: 2026-01-16
status: completed
agent: Codex
---

## Summary

- Updated the npm publish workflow name and removed the package name override step.
- Dropped the unused `packages: write` permission for the npm workflow.

## Rationale

- The workflow now reflects its actual target and avoids forcing the npm scope to match the GitHub owner.
