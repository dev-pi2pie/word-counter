---
title: "Keep progress visibility flag for batch mode"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Goal

Add an explicit opt-in flag to keep the final progress line visible after batch counting completes, while preserving the current default transient behavior.

## Scope

- Add CLI flag: `--keep-progress`.
- Keep default behavior unchanged (progress line auto-clears).
- Keep `--debug` behavior unchanged (final progress line remains visible).
- Add tests covering flag behavior and precedence with `--no-progress`.
- Update CLI documentation.

## Acceptance

- `--keep-progress` in standard batch mode keeps the final progress line visible.
- Without `--keep-progress` and without `--debug`, progress remains transient.
- `--no-progress` disables progress regardless of `--keep-progress`.
- `raw` and `json` outputs remain clean.

## Related Research

- `docs/researches/research-2026-02-13-cli-progress-indicator.md`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
