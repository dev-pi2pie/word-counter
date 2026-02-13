---
title: "Fix branch glob fetching in release workflows"
created-date: 2026-01-16
status: completed
agent: codex
---

## Summary
- updated workflow branch fetch patterns to use explicit refspecs so git fetch works with globbed branch names.
- increased fetch depth to 100 to improve tag ancestry detection for non-tip commits.
- keeps allowed-branch validation intact for main, beta*, alpha*, canary*, and dev*.

## Why
- git fetch does not accept bare glob patterns (e.g., "beta*") as valid refspecs, causing release workflows to fail before checking branch ancestry.
