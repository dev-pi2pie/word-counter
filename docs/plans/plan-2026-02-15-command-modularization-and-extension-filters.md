---
title: "command modularization and extension filter flags"
created-date: 2026-02-15
status: draft
agent: Codex
---

## Goal

Reduce `src/command.ts` complexity by separating batch/path/output concerns into focused modules, and add explicit extension-filter controls (`--include-ext`, `--exclude-ext`) with deterministic conflict handling.

## Scope

- In scope:
  - Refactor-only separation of `src/command.ts` without changing existing behavior.
  - Add `--include-ext` and `--exclude-ext` for directory-expanded files.
  - Define and test extension conflict resolution rules.
- Out of scope:
  - Progress bar/debug channel behavior from Phase 2.
  - JSON schema redesign beyond what is required for extension filter behavior.

## Proposed Structure

- Keep `src/command.ts` as the CLI composition layer and stable export surface.
- Move internals to submodules under `src/cli/`:
  - `src/cli/path/filter.ts`
    - extension normalization and include/exclude decision logic
  - `src/cli/path/resolve.ts`
    - path metadata resolution, directory traversal, deterministic ordering
  - `src/cli/path/load.ts`
    - file loading, binary detection, skip reasons
  - `src/cli/batch/aggregate.ts`
    - batch merge behavior for normal and sectioned results
  - `src/cli/output/render.ts`
    - standard/raw/json rendering and skip reporting

## Extension Filter Semantics

### Baseline

- Default directory include set remains:
  - `.md`, `.markdown`, `.mdx`, `.mdc`, `.txt`
- Direct explicit file paths (`--path /file.ext`) remain accepted regardless of extension, then still pass through unreadable/binary checks.

### New Flags

- `--include-ext <exts>`
  - overrides default include set for directory scanning.
- `--exclude-ext <exts>`
  - removes extensions from the included candidate set.

### Normalization

- Case-insensitive extension matching.
- Accept both `md` and `.md`; normalize to `.md`.
- Split comma-delimited values and trim whitespace.
- Deduplicate extensions.

### Conflict Handling

- Both flags may be used together.
- Evaluation order:
  1. build include set (default or `--include-ext` override)
  2. subtract `--exclude-ext`
- If same extension exists in both sets, exclusion wins.
- Empty final include set is valid and yields zero directory matches (with skips/reporting behavior unchanged).

## Implementation Plan

### Step 1 - Safe Refactor (No Behavior Change)

- Extract path resolution, loading, aggregation, and rendering modules.
- Keep current function names exported by `src/command.ts` for compatibility with existing tests/imports.
- Ensure all current tests pass before adding new flag behavior.

### Step 2 - Add Extension Filter Flags

- Add CLI options:
  - `--include-ext <exts>`
  - `--exclude-ext <exts>`
- Wire normalized include/exclude sets into directory expansion filtering.
- Preserve direct-file `--path` behavior.

### Step 3 - Tests and Compatibility Validation

- Add tests for:
  - include-only filtering
  - exclude-only filtering
  - include+exclude conflict precedence
  - normalization (`md`, `.MD`, spaces, duplicates)
  - behavior when final include set is empty
- Re-run compatibility tests to ensure single-input and existing default flows are unchanged.

## Acceptance Criteria

- `src/command.ts` is materially thinner and delegates to module functions.
- Existing tests continue to pass after refactor step.
- New extension flags function as specified with deterministic precedence.
- Directory-scanned file inclusion is explicitly controllable via CLI without regressing direct-file path handling.

## Risks and Mitigations

- Risk: behavior drift during refactor.
  - Mitigation: split into refactor-first commit, then feature commit; run full test suite after each step.
- Risk: user confusion about filter scope.
  - Mitigation: keep rule simple (directory scans only), document precedence clearly in CLI help and README updates.

## Related Research

- `docs/research-2026-02-13-batch-file-counting.md`
- `docs/schemas/default-config.md`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
