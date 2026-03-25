---
title: "detector inspect phase 3 and phase 4 implementation"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Implement the detector-subpath inspector API and the first-version `word-counter inspect` CLI contract.

## What Changed

- Added the first-class async detector inspector API:
  - `inspectTextWithDetector`
  - `inspectTextWithRegexDetector`
  - `inspectTextWithWasmDetector`
- Exported detector inspect types and detector debug helper types from the detector subpath.
- Added traced regex segmentation for inspect-only deterministic chunk provenance.
- Added the explicit `inspect` CLI subcommand with first-version support for:
  - `--detector wasm|regex`
  - `--view pipeline|engine`
  - `--format standard|json`
  - positional text input
  - one `--path <file>` input
- Enforced single-input-only inspect validation and clear error messages for unsupported combinations.
- Added standard and JSON inspect rendering.
- Updated README detector-subpath and `inspect` command documentation.
- Added library, CLI, package-types, and CJS regression coverage for the new inspect surface.

## Validation

- `bun test`
- `bun run type-check`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
