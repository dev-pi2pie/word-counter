---
title: "JSON output schema and per-file total-of metadata"
created-date: 2026-02-17
modified-date: 2026-02-17
status: completed
agent: Codex
---

## Goal

Implement and document a consistent JSON output contract for optional features, with a specific fix for `--per-file --format json --total-of` so per-file override metadata is exposed.

## Scope

- In scope:
  - Add per-file `total-of` metadata to per-file JSON output.
  - Add/adjust CLI tests for per-file JSON + `--total-of`.
  - Add dedicated JSON schema contract documentation.
  - Re-check and update related docs (README + schema docs links/notes).
- Out of scope:
  - Breaking JSON shape changes for existing single/merged outputs.
  - Config-file implementation changes.

## Task Items

- [x] Implement code changes for per-file JSON `total-of` metadata.
- [x] Add tests for per-file JSON + `--total-of` (non-section and sectioned).
- [x] Add dedicated JSON output schema contract doc in schema docs.
- [x] Re-check and update related docs (README and references).
- [x] Run validation (`bun test` targeted suite) and finalize.

## Execution Notes

- Preserve backward compatibility by keeping current aggregate metadata fields.
- Add new per-file metadata as additive fields only.

## Validation

- `bun test test/command.test.ts` (pass)
- `bun run type-check` (currently fails in existing file: `src/cli/debug/channel.ts:75`)

## Related Research

- `docs/researches/research-2026-02-17-json-output-schema-contract.md`
