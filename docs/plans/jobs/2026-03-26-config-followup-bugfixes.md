---
title: "config follow-up bugfixes"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Patch the follow-up config regressions around macOS user-config path wording, inspect engine-view validation timing, debug-only config activation, and default-reference example behavior.

## What Changed

- Changed macOS user-config resolution to honor `$XDG_CONFIG_HOME` first, then `$HOME/.config`, while keeping `$HOME/Library/Application Support` as a legacy fallback.
- Changed Windows user-config resolution to use `%USERPROFILE%\.config` as the primary path while keeping `%AppData%` as a legacy fallback.
- Deferred inspect `--view engine` detector compatibility checks until after config and env defaults are applied.
- Stopped config-only `logging.verbosity`, `reporting.debugReport.path`, and `reporting.debugReport.tee` from materializing as active debug flags unless debug is effectively enabled.
- Removed `reporting.skippedFiles = false` from default-reference example configs so copying them no longer changes default skipped-file behavior.
- Updated the affected schema, guide, research, plan, and example docs to match the patched behavior.

## Verification

- `bun test test/cli-config.test.ts test/command-config.test.ts test/command-debug.test.ts test/example-config-files.test.ts`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-26-config-file-support-and-detector-defaults.md`
- `docs/plans/plan-2026-03-26-config-content-gate-support.md`
