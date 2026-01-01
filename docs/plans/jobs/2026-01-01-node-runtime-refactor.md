---
title: "Node.js runtime refactor"
date: 2026-01-01
status: completed
agent: Codex
---

## Summary
Refactor the CLI and package to target Node.js runtime, with dual ESM/CJS library outputs and an ESM CLI. Add CLI flags for format/mode/version/path input, add tests, and configure build/test/type-check scripts.

## Decisions
- Build outputs: dual ESM/CJS for library, ESM for CLI.
- CLI flags: `--format` (standard/raw/json), `--pretty` for JSON, `--path` for file input, `--mode` (chunk/segments/collector), `--version` aligned to package.json.
- Tests: `bun test` with a `test/` folder.

## Work Items
- Implement Node-first CLI entry and input handling.
- Split library exports from CLI runtime logic.
- Add tsdown config for dual formats + dts.
- Update package.json exports/files/bin/scripts.
- Add initial unit tests.
- Update README with new usage and flags.

## Notes
- Added `--format` (standard/raw/json), `--pretty`, and `--path` options to the CLI.
- CLI now reads from args, stdin, or file path (in that priority).
