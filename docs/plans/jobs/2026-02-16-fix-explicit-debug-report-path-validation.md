---
title: "Fix explicit debug report path validation"
created-date: 2026-02-16
status: completed
agent: codex
---

## Summary

Adjusted debug report path resolution so explicit `--debug-report <path>` values are treated as fixed file targets instead of collision-suffixed candidates.

## What Changed

- Updated `src/cli/debug/channel.ts`:
  - explicit report paths now bypass collision suffixing.
  - explicit report paths that resolve to existing directories now fail fast with a clear error.
  - default generated report names still use `-<n>` collision suffixing.
- Added regression tests in `test/command.test.ts`:
  - rejects explicit directory report paths.
  - preserves explicit existing file paths (append behavior, no `-1` sibling file).
- Updated `README.md` debug-report contract text to clarify collision behavior applies to default names and explicit directory paths are rejected.

## Why

Explicit paths should be reliable output contracts for callers. Auto-suffixing a directory path silently redirects output and makes the user-provided path unreliable.

## Verification

- `bun test test/command.test.ts`
