---
title: "Modularize TOML Frontmatter Parser"
created-date: 2026-01-15
status: completed
agent: Codex
---

## Goal
Refactor `src/markdown/toml-simple.ts` into smaller, focused modules while preserving current behavior and public APIs.

## Context
The existing TOML frontmatter parser is a single large file with multiple responsibilities (tokenization, normalization, parsing, and flattening). This makes it harder to reason about and maintain. We want a cleaner separation while keeping the current exported functions and runtime behavior unchanged.

## Scope
- Keep `parseTomlFrontmatter(frontmatter: string): Record<string, unknown> | null` unchanged.
- Preserve current parsing behavior, output formatting, and error handling.
- Split internal helpers into modules by responsibility.
- Keep Node.js compatibility; Bun remains tooling only.

## Non-Goals
- Expanding TOML feature coverage.
- Behavior changes or new parsing rules.
- Performance optimizations beyond reasonable refactors.

## Proposed Module Structure
Suggested file layout under `src/markdown/toml/`:
- `index.ts` — re-export `parseTomlFrontmatter` (or keep re-export in `toml-simple.ts`).
- `parse-frontmatter.ts` — orchestration logic (line iteration, table handling, result assembly).
- `keys.ts` — `stripKeyQuotes`, `normalizeKeyPath`.
- `strings.ts` — `unescapeBasic`, `parseStringLiteral`, `stripInlineComment`.
- `values.ts` — `parsePrimitive`, `parseArray`, `parseInlineTable`, `normalizeValue`, `toPlainText`.
- `arrays.ts` — `ensureArrayContainer`, array-of-tables flattening helper.

## Plan
1. Define module boundaries and move helpers into dedicated files.
2. Add a single internal interface/type file for shared types (e.g., `TomlValue`).
3. Keep `parseTomlFrontmatter` as the single public entry point and export surface.
4. Update imports and ensure existing tests still pass (or add a lightweight smoke test if none exist).

## Acceptance Criteria
- `parseTomlFrontmatter` signature and behavior are unchanged.
- No changes to CLI output or section counting behavior.
- `toml-simple.ts` becomes a thin entry module or is replaced by the new module tree.

## Related Plans
- `docs/plans/plan-2026-01-15-simple-toml-parser.md`
