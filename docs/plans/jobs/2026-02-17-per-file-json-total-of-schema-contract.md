---
title: "Per-file JSON total-of metadata and output schema contract"
created-date: 2026-02-17
modified-date: 2026-02-17
status: completed
agent: Codex
---

## Scope

Implement issue #38 by exposing per-file `--total-of` metadata in per-file JSON output, then document the JSON output contract and update related docs.

## What Changed

- Add per-file `meta.totalOf` and `meta.totalOfOverride` under `files[i]` for `--per-file --format json --total-of`.
- Preserve existing top-level per-file `meta.aggregateTotalOfOverride` compatibility field.
- Add regression tests for non-section and sectioned (`--section split`) per-file JSON + `--total-of`.
- Add regression coverage for all section modes (`split`, `frontmatter`, `content`, `per-key`, `split-per-key`) with per-file JSON + `--total-of`.
- Add dedicated JSON output contract doc and update README references.
- Add example fixtures for per-file JSON results:
  - `examples/test-case-per-files-json-result`

## Validation

- `bun test test/command.test.ts` (pass)
- `bun run type-check` (fails in existing file: `src/cli/debug/channel.ts:75`)

## Related Plans

- `docs/plans/plan-2026-02-17-json-output-schema-and-per-file-total-of.md`
