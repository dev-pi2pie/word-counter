---
title: "cli flag precedence followups"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Patch the remaining precedence regressions where config or env defaults could not be overridden by one-off CLI flags, and make non-fatal config notes respect `--quiet-warnings`.

## What Changed

- Added positive `--progress` and `--recursive` flags to the root counting CLI.
- Added positive `--recursive` handling to `inspect`.
- Preserved explicit CLI precedence so `--progress` can override `progress.mode = "off"` and `WORD_COUNTER_PROGRESS=off`.
- Preserved explicit CLI precedence so `--recursive` can override `path.recursive = false` for both counting and `inspect`.
- Made config discovery notes respect `--quiet-warnings`.
- Updated help text, README, and the inspect output contract docs to reflect the positive flag forms.
- Updated README and `docs/batch-jobs-usage-guide.md` to document the broader `--quiet-warnings` suppression scope for non-fatal config notes and batch-route warnings.

## Verification

- `bun test test/cli-config.test.ts test/command-config.test.ts test/command-progress.test.ts test/example-config-files.test.ts`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-03-26-config-file-support-and-detector-defaults.md`
