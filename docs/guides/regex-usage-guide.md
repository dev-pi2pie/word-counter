---
title: "Regex Usage Guide"
created-date: 2026-02-17
status: completed
agent: Codex
---

# Regex Usage Guide

## Goal

Clarify how `--regex` behaves during batch path resolution.

## Contract

- `--regex <pattern>` filters only files discovered from `--path <dir>` directory expansion.
- Matching is evaluated against each directory root-relative file path.
- The same regex is shared across all directory roots in the same run.
- Direct file inputs (for example, `--path ./notes.txt`) stay literal and are never blocked by regex filters.
- `--regex` is single-use; repeated flags fail fast with `` `--regex` can only be provided once. ``.
- Empty regex input behaves as no regex restriction.
- In `--path-mode manual`, directories are not expanded, so `--regex` has no directory-scan surface to filter.

## Examples

Include only files named `child.md` under each scanned root:

```bash
word-counter --path ./docs --path ./examples --regex '^child\\.md$'
```

Include only markdown files under `notes/` within each root:

```bash
word-counter --path ./workspace-a --path ./workspace-b --regex '^notes/.*\\.md$'
```

Explicit file paths bypass regex filters:

```bash
word-counter --path ./examples/ignored.js --regex '^.*\\.md$'
```

## Troubleshooting

- Repeated regex flags:
  - command: `word-counter --path ./docs --regex '^a\\.md$' --regex '^b\\.md$'`
  - result: fails with `` `--regex` can only be provided once. ``
- Invalid regex pattern:
  - command: `word-counter --path ./docs --regex '['`
  - result: fails with `Invalid --regex pattern: ...`

## Related Plans

- `docs/plans/plan-2026-02-17-path-mode-clarity-and-regex-filtering.md`
