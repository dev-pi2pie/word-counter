---
title: "JSON output schema contract for optional feature mapping"
created-date: 2026-02-17
status: completed
agent: Codex
---

## Goal

Define a clear, backward-compatible JSON output contract that maps optional CLI feature flags to predictable JSON fields across single-input, merged batch, and per-file batch modes.

## Milestone Goal

Close the `--per-file --format json --total-of` contract gap by defining where override metadata should live for aggregate and per-file records, and document feature-to-field mapping in a dedicated schema doc.

## Key Findings

- Current implementation computes per-file `--total-of` overrides, but per-file JSON output does not expose them.
- Single-result JSON already uses `meta.totalOf` and `meta.totalOfOverride`.
- Per-file JSON currently uses top-level `meta.totalOf` plus `meta.aggregateTotalOfOverride`, which is useful but incomplete for per-file consumers.
- Existing docs do not define a full JSON output schema contract for batch variants.
- Existing schema docs are currently config-focused (`docs/schemas/default-config.md`) and do not define output payload contracts.

## Proposed Direction

- Keep existing top-level aggregate metadata in per-file JSON for compatibility.
- Add per-file metadata in `files[i].meta` when `--total-of` is provided:
  - `files[i].meta.totalOf`
  - `files[i].meta.totalOfOverride`
- Keep merged/single JSON behavior unchanged:
  - single/merged use `meta.totalOf` and `meta.totalOfOverride`
- Publish one dedicated output contract doc that defines:
  - base shapes (`single`, `merged`, `per-file`)
  - optional fields for `--total-of`, `--debug`, `--section`, `--non-words`, and `--pretty` formatting note

## Optional Feature Mapping (JSON)

- `--total-of`:
  - single/merged: `meta.totalOf`, `meta.totalOfOverride`
  - per-file: top-level `meta.totalOf`, `meta.aggregateTotalOfOverride`, and per-entry `files[i].meta.totalOf`, `files[i].meta.totalOfOverride`
- `--per-file`:
  - wraps results in `{ scope: "per-file", files: [...], aggregate: ... }`
- `--section <mode != all>`:
  - result shape becomes sectioned (`section`, `frontmatterType`, `items[]`)
- `--debug` (per-file JSON only):
  - adds `skipped` array when skip diagnostics are enabled
- `--non-words` / `--include-whitespace` / `--misc`:
  - include non-word fields in counts/breakdown paths
- `--pretty`:
  - whitespace formatting only; no schema change

## Implications or Recommendations

- Add regression tests specifically for per-file JSON + `--total-of` in both non-sectioned and sectioned runs.
- Avoid removing or renaming current top-level per-file metadata in this phase to reduce downstream break risk.
- Document field-level compatibility notes so downstream parsers can migrate safely.

## Decisions

- Per-file JSON contract should expose both aggregate-level and per-file-level override metadata when `--total-of` is set.
- Existing top-level `meta.aggregateTotalOfOverride` remains for compatibility.
- New output contract documentation is added under the schema docs area.

## Related Plans

- `docs/plans/plan-2026-02-17-json-output-schema-and-per-file-total-of.md`

## References

- `src/cli/runtime/batch.ts`
- `src/cli/runtime/single.ts`
- `test/command.test.ts`
- `README.md`
- `docs/research-2026-02-13-total-combination-mode.md`
