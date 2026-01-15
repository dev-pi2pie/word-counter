---
title: "Simple TOML Frontmatter Parser (Per-Key Counting)"
date: 2026-01-15
status: draft
agent: codex
---

## Goal
Provide a minimal TOML parser for frontmatter so `--section per-key` and `--section split-per-key` can extract key/value pairs and count them as plain text strings, while keeping security risks low and remaining compatible with the current frontmatter parsing design.

## Related Research
- [Frontmatter vs Content Counting Modes: Parsing Options](../research-2026-01-15-frontmatter-counting-modes.md)

## Related Plans
- [Custom YAML Frontmatter Split for Two Counting Modes](plan-2026-01-15-custom-yaml-frontmatter.md)

## Scope
- Parse only TOML frontmatter detected by `+++` fences.
- Focus on **top-level key/value pairs** needed for per-key word counting.
- Convert values to **plain text strings** for word counting (no evaluation or execution).
- Treat TOML tables and arrays as valid, but reduce them to deterministic text:
  - Arrays => join element strings with `", "` then count.
  - Tables/maps => flatten to dotted keys and count leaf values.

## Non-Goals
- Full TOML v1.1.0 compliance.
- Nested tables, arrays of tables, and datetime type fidelity.
- Preserving type information beyond conversion to plain text.

## Compatibility Target (Hugo-like)
Aim to support the most common Hugo TOML frontmatter patterns:
- Top-level key/value pairs.
- Tables (`[table]`) and dotted keys.
- Arrays of primitives and arrays of strings.
- Inline tables and arrays of tables are **out of scope** for the initial parser.

## Plan
1. Define the supported TOML subset:
   - Top-level `key = value` only.
   - Supported values: strings, integers, floats, booleans, datetimes (as text), arrays of primitives.
   - Support tables (`[table]`) and dotted keys by flattening to dotted form (e.g., `params.author`).
   - Defer inline tables (`{}`) and arrays of tables (`[[table]]`) for now.
2. Parser behavior and error strategy:
   - Fail **silently** by returning `null` data when TOML is out of scope or malformed.
   - Keep raw frontmatter available for `split`/`frontmatter` modes.
   - Reserve detailed error reporting for future `--debug` mode.
3. Implementation sketch:
   - Split on newlines; skip blank lines and comments (`#`).
   - Match `key = value` with a safe, non-greedy parser.
   - Parse quoted strings (single/double), basic numbers, booleans, and simple arrays.
   - Allow dotted keys in assignments (e.g., `params.author = "Ada"`).
   - Convert values to plain text by JSON stringification or direct string conversion **before counting**.
   - When a table header is encountered (`[table]`), prefix subsequent keys with the table path.
   - Arrays are converted to a joined string (`", "` separator) before counting.
4. Integration points:
   - Add a `parseTomlFrontmatter` helper in `src/markdown/parse-markdown.ts`.
   - Use it when `frontmatterType === "toml"`.
   - Ensure `countSections` treats TOML `data` the same as YAML/JSON data.
5. Tests:
   - Basic key/value pairs (string, number, boolean).
   - Arrays of primitives.
   - Comments and blank lines.
   - Out-of-scope constructs are ignored or cause null `data`.

## Acceptance Criteria
- TOML frontmatter enables `per-key` and `split-per-key` counts without throwing.
- Out-of-scope TOML does not crash; it yields `data: null` or skips invalid keys.
- Tests cover common TOML frontmatter patterns and edge cases.

## Notes
- All values are converted to **plain text** before counting (no evaluation).
- Security: avoid `eval` or dynamic execution; treat all TOML as untrusted text.

## References
- [TOML v1.1.0 specification](https://toml.io/en/v1.1.0)
