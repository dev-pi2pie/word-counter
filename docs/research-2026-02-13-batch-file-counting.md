---
title: "Batch file counting mode"
created-date: 2026-02-13
modified-date: 2026-02-16
status: completed
agent: Codex
milestone: v0.1.0
---

## Goal

Design a batch counting mode that can process multiple files (and directory targets) in one run while preserving current single-input behavior.

## Milestone Goal

Ship a `v0.1.0` canary-ready batch workflow that feels meaningfully more useful for real projects and does not break existing command usage.

## Key Findings

- Current CLI behavior effectively handles one resolved input at a time (`text`, stdin, or a single `--path` value).
- Real usage often needs project-scale counting (many files, globs, or directory scopes), which currently requires shell loops outside the tool.
- The lowest-risk compatibility path is additive:
  - keep existing single-file and text behavior unchanged
  - extend `--path` to support repeated values
  - optionally add directory/glob resolution as explicit batch behavior
- For predictable output and testing:
  - use deterministic file ordering (sorted)
  - define clear handling of unreadable/binary files
  - support both merged and per-file perspectives with explicit scope flags

## Proposed Direction

- Input expansion (additive):
  - allow repeated `--path` flags
  - accept directory paths as batch targets
  - optionally support glob patterns
- Batch scope controls:
  - default multi-file behavior is `--merged` (aggregate as one result)
  - optional `--per-file` shows file-level results plus aggregate summary
- Processing model:
  - resolve all files first
  - run counting per file internally for deterministic aggregation
  - for `--section`, parse/count per file and aggregate section buckets across files
- Output model:
  - `standard` with `--merged`: aggregate result only
  - `standard` with `--per-file`: per-file lines and final aggregate summary
  - `raw`: aggregate total only (for script compatibility)
  - `json`: keep current shape for single input; define explicit batch JSON behavior only if needed in a later scoped change

## Implications or Recommendations

- Keep JSON contract unchanged in this phase unless batch JSON shape is explicitly scoped and gated.
- Introduce batch mode incrementally:
  - canary step 1: repeated `--path` (multiple files)
  - canary step 2: directory + optional glob
- Add tests for:
  - mixed valid/invalid paths
  - deterministic file order
  - aggregate totals matching per-file sums
  - `--merged` and `--per-file` scope behavior
  - `--section` aggregation across multi-file runs (including files without frontmatter)
  - behavior parity across modes (`chunk`, `segments`, `collector`, `char`)

## Decisions

- Directory handling:
  - default path mode is `auto` (detect file vs directory via filesystem metadata, not extension)
  - auto mode can be disabled and switched to manual mode via `--path-mode manual` (or env/config equivalent)
  - for extensionless paths, rely on path metadata (`stat`) first, then file inspection when needed
  - directory traversal is recursive by default and can be disabled with `--no-recursive`
- Batch scope handling:
  - multi-file runs default to `--merged`
  - `--per-file` is the opposite scope and shows file-level output + aggregate
  - if both are passed, last flag wins (CLI parser precedence)
- File inclusion defaults for directory targets:
  - include text-like files by default (for example `.md`, `.markdown`, `.mdx`, `.mdc`, `.txt`)
  - skip binary files by default
  - allow include/exclude extension filters as optional overrides (`--include-ext`, `--exclude-ext`)
  - support fuzzy matching as a future improvement
- Unreadable files:
  - do not fail-fast by default
  - report unreadable files and continue processing
  - allow suppression of skipped/unreadable reporting via `--quiet-skips`
- Section behavior in batch:
  - `--section` is evaluated per file, then aggregated across files
  - files without frontmatter (for example `.txt`) are treated as content-only for section totals
  - in `--section frontmatter`, non-frontmatter files contribute zero frontmatter counts

## Related Plans

None.

## References

- `src/command.ts`
- `src/wc/wc.ts`
- `README.md`
- `docs/schemas/default-config.md`
