---
title: "config content gate support"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Finish the missing config-layer support for detector policy mode so `contentGate` follows the same precedence contract as detector selection across config files, environment variables, and CLI flags.

## What Changed

- Added root config support for `contentGate.mode`.
- Added inspect-specific config support for `inspect.contentGate.mode`.
- Added environment-variable support for `WORD_COUNTER_CONTENT_GATE`.
- Wired config and env content-gate values into counting and inspect flows without overriding explicit CLI `--content-gate` values.
- Added regression coverage for:
  - config parsing across `toml`, `json`, and `jsonc`
  - environment-backed content-gate resolution
  - count precedence across config, env, and CLI
  - inspect inheritance from root `contentGate.mode`
  - inspect-only override via `inspect.contentGate.mode`
- Updated schema, guide, README, and example config files to document the completed contract.

## Verification

- `bun test test/cli-config.test.ts test/command-config.test.ts test/example-config-files.test.ts`
- `bun run type-check`

## Related Research

- `docs/researches/research-2026-03-26-config-layer-and-detector-defaults.md`

## Related Plans

- `docs/plans/plan-2026-03-26-config-content-gate-support.md`
