---
title: "regex directory filtering implementation"
created-date: 2026-02-17
modified-date: 2026-02-17
status: completed
agent: Codex
---

## Goal

Implement Issue #36 regex filtering with the agreed contract for directory scans.

## What Changed

- Added `--regex <pattern>` CLI option for batch directory scanning.
- Enforced single-usage contract for `--regex` and added a clear misuse error when repeated.
- Fixed the single-usage guard so regex values beginning with `--regex=...` are treated as values, not duplicate flags.
- Added directory regex filter utilities and root-relative path matching.
- Applied regex filtering only to directory-expanded files from `--path <dir>`.
- Preserved explicit file-path behavior (`--path /file.txt` remains literal and not regex-filtered).
- Added regex exclusion debug diagnostics in verbose mode.
- Kept merged/dedupe behavior deterministic across multiple directory roots.
- Fixed overlapping-root skip diagnostics so files already included are not later reported as `regex excluded`.
- Added test coverage for:
  - root-relative filtering
  - multi-root unified regex + dedupe
  - overlapping root input order without false regex skip entries
  - direct file path bypass
  - empty regex fallback
  - invalid regex failure
  - repeated `--regex` misuse detection
  - regex value tokens that begin with `--regex=` (no false duplicate error)

## Validation

- `bun test` passed.
- `bun run type-check` still reports a pre-existing error in `src/cli/debug/channel.ts` unrelated to this implementation.

## Related Plans

- `docs/plans/plan-2026-02-17-path-mode-clarity-and-regex-filtering.md`

## Related Research

- `docs/researches/research-2026-02-17-filename-regex-matching.md`
