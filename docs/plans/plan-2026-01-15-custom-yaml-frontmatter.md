---
title: "Custom YAML Frontmatter Split for Two Counting Modes"
date: 2026-01-15
status: completed
agent: codex
---

## Goal
Implement a `custom + yaml` frontmatter splitter (with multi-format fence detection) that returns frontmatter vs content in a `parseMarkdown`-style API, enabling multiple counting modes (all, two sections, per-key) with clear tests for edge cases.

## Related Research
- [Frontmatter vs Content Counting Modes: Parsing Options](../research-2026-01-15-frontmatter-counting-modes.md)

## Plan
1. Define the parsing contract and naming:
   - Use `parseMarkdown` (or agreed name) and return `{ frontmatter, content, data, frontmatterType }`.
   - `frontmatter`: raw block without fences or `null` if absent.
   - `content`: the remaining document body.
   - `data`: parsed object or `null` if no frontmatter or parse failure.
   - `frontmatterType`: `"yaml" | "toml" | "json" | null` to enable format-aware errors and future behavior.
2. Implement multi-format fence detection:
   - Accept only **top-of-file** frontmatter (allow BOM; no leading non-whitespace).
   - Fence mapping:
     - `---` => YAML
     - `+++` => TOML
     - `;;;` => JSON (optional, common in some tooling)
   - Closing fence must match opening fence and appear on its own line.
   - Hugo compatibility: also recognize top-of-file JSON objects (`{ ... }`) as frontmatter to align with Hugo’s JSON front matter format. [^1]
3. Parse frontmatter by type:
   - YAML: `yaml.parseDocument` (or `yaml.parse`).
   - TOML/JSON: pick parser strategy (TOML parser TBD; JSON via `JSON.parse`).
   - Error handling: default to **silent failure** (treat as no data but preserve raw frontmatter); expose parse errors only in `--debug` mode.
4. Integrate into CLI counting flow:
   - Keep `--mode` for locale breakdown only (`chunk | segments | collector`).
   - Add `--section` to control document-part counting:
     - `all` (default) => treat file as a single block (fast path, no split).
     - `split` => count `frontmatter` and `content` separately.
     - `frontmatter` => count frontmatter only.
     - `content` => count content only.
     - `per-key` => split frontmatter into per-key word counts only (no content output).
     - `split-per-key` => per-key frontmatter counts plus a single content block.
   - `--format` continues to control output shape, independent from `--mode` and `--section`.
5. Tests (Bun):
   - Happy paths: YAML/TOML/JSON frontmatter + body; frontmatter-only file.
   - Edge cases: BOM, CRLF, missing closing fence, mismatched fence, `---` in code fences, leading blank lines, empty frontmatter block, invalid YAML/TOML/JSON.
   - Confirm that Obsidian-style top-of-file frontmatter is accepted and counted.

## Acceptance Criteria
- `parseMarkdown` (or agreed name) returns consistent `frontmatter` + `content` split.
- Counting modes correctly report word counts for each part, including per-key breakdowns.
- Tests cover a broad set of frontmatter edge cases and pass in Bun.

## Notes
- Keep compatibility with Node.js runtime even when using Bun for tooling.

## References
[^1]: [Hugo front matter formats](https://gohugo.io/content-management/front-matter/)
