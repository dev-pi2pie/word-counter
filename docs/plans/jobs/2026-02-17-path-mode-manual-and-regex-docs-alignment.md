---
title: "path mode manual and regex docs alignment"
created-date: 2026-02-17
status: completed
agent: Codex
---

## Goal

Complete the remaining docs checkpoints in the path-mode clarity and regex filtering plan.

## What Changed

- Updated CLI help text in `src/cli/program/options.ts` to make `--path-mode` behavior explicit:
  - `auto` expands directories.
  - `manual` treats `--path` values as file inputs.
- Updated README path contract wording to remove issue-tag framing and clarify `manual` behavior:
  - `--path <dir>` is not supported in `manual` mode and is skipped as `not a regular file`.
- Added README regex section documenting directory-scan-only scope, root-relative matching, single-use contract, and direct-file bypass.
- Added `docs/regex-usage-guide.md` for regex behavior details, examples, and troubleshooting.
- Synced `docs/schemas/default-config.md` path-mode wording with the same manual-mode contract.
- Marked `docs/plans/plan-2026-02-17-path-mode-clarity-and-regex-filtering.md` as completed and checked remaining implementation checkpoints.

## Validation

- `bun test test/command.test.ts`

## Related Plans

- `docs/plans/plan-2026-02-17-path-mode-clarity-and-regex-filtering.md`
