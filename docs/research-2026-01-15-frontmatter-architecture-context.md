---
title: "Frontmatter Architecture Context"
date: 2026-01-15
status: draft
agent: codex
---

## Goal
Clarify the architectural layering for markdown handling so frontmatter decisions (format support, parsing scope, counting modes) stay separated from locale-aware word counting.

## Key Findings
- The current CLI has two orthogonal concerns: **document structure** (frontmatter vs content) and **locale-aware word counting** (chunk/segments/collector). Conflating them in a single flag (`--mode`) would make the CLI harder to reason about.
- A clear boundary helps: `Markdown → Frontmatter → Parser → Counting`, where parsing only splits/decodes metadata and counting stays format-agnostic.
- TOML support is a subtopic of frontmatter parsing; it should not dictate the higher-level interface for counting or output.

## Architecture Context
```
Input (stdin / --path / args)
            |
            v
       Markdown text
            |
            v
   [Frontmatter detection]
   - top-of-file only
   - delimiter -> type
            |
            v
   { frontmatter, content, data, frontmatterType }
            |
            v
     [Parser/Normalizer]
   - YAML/JSON/TOML parse
   - values -> plain text
            |
            v
      [Section selector]
   --section all | split | frontmatter
             | content | per-key | split-per-key
            |
            v
   [Locale-aware counting]
   --mode chunk | segments | collector
            |
            v
       Output (--format)
```

- **Markdown layer:** raw text input from `--path`, stdin, or CLI tokens.
- **Frontmatter layer:** detect and split top-of-file metadata blocks (YAML/TOML/JSON) and return `{ frontmatter, content, data, frontmatterType }`.
- **Parser layer:** parse frontmatter into a structured object (YAML/JSON/TOML), then normalize values to **plain text strings** for per-key counting.
- **Counting layer:** run locale-aware word counting on either the full document or selected sections.

## Implications or Recommendations
- Keep `--mode` reserved for locale breakdown and add `--section` for document parts.
- Treat TOML parsing as a focused sub-plan with its own scope and tests.
- Align frontmatter detection with Hugo-like conventions (top-of-file only, format inferred by delimiters) while keeping implementation decoupled from the word counter core.

## Related Plans
- [Custom YAML Frontmatter Split for Two Counting Modes](plans/plan-2026-01-15-custom-yaml-frontmatter.md)
- [Simple TOML Frontmatter Parser (Per-Key Counting)](plans/plan-2026-01-15-simple-toml-parser.md)
