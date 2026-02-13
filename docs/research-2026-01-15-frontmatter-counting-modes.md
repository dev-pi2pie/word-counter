---
title: "Frontmatter vs Content Counting Modes: Parsing Options"
created-date: 2026-01-15
status: completed
agent: codex
---

## Goal
Evaluate whether the CLI should implement its own frontmatter splitter for Markdown word counts or rely on ecosystem libraries, and summarize tradeoffs for a “frontmatter vs content” counting mode.

## Key Findings
- `gray-matter` is a purpose-built frontmatter parser that splits a string into `data` (parsed frontmatter) and `content` (body). It supports multiple frontmatter languages (YAML by default, plus JSON, TOML, etc.) and custom delimiters. This directly matches the “two modes” need (frontmatter vs content) without requiring a Markdown AST. [^1]
- `remark-mdc` is a remark plugin that parses MDC syntax and documents YAML frontmatter usage as part of that syntax. It is best suited when you already need MDC parsing or a remark pipeline, not just frontmatter separation. [^2]
- `remark-frontmatter` and `micromark-extension-frontmatter` are ecosystem tools that add frontmatter support to a Markdown parsing pipeline (remark/micromark). These are oriented around syntax trees or HTML conversion and are ESM-only. [^3] [^4]
- There is no formal frontmatter spec; ecosystem tools follow GitHub-style YAML fence conventions and optionally TOML. Frontmatter is typically only valid at the start of the document, and tools emphasize portability by discouraging “frontmatter anywhere.” [^4]
- `yaml` (eemeli/yaml) is a full YAML parser/stringifier library with no external dependencies and supports YAML 1.1/1.2, but it does **not** provide frontmatter splitting. It is most useful when you already control the split logic and only need to parse the YAML block. [^6] [^7]
- Obsidian documents that YAML frontmatter must be placed at the very top of a note and is treated as metadata for tags, aliases, and publishing settings. This reinforces the “frontmatter is a top-of-file fence” assumption for compatibility with common editors. [^8]

## Analysis
- The `remark-mdc` `frontmatter.ts` implementation is **YAML-only** and assumes `---` fences at the start of the document. It searches for the first `\n---` and splits there, then parses YAML via `parseDocument`. This matches a minimal “frontmatter vs content” split, but is intentionally limited to YAML. [^5]
- `remark-mdc` adds behavior beyond simple splitting: it **unflattens** keys (so `a.b: 1` becomes nested objects), optionally **preserves key order** via a `__order__` structure, and includes **stringify helpers** plus a “codeblock props” style (` ```yaml [props] `). These are useful if you need MDC-specific behaviors, but are extra surface area for a counting-only CLI. [^5]
- `gray-matter` explicitly avoids regex parsing and advertises resilience to edge cases (e.g., code fences that look like frontmatter). For a CLI that only needs to count frontmatter separately, this reduces risk compared to a custom splitter. [^1]
- If you plan to adopt remark or MDC later, `remark-frontmatter`/`micromark-extension-frontmatter` align with unified’s syntax-tree workflow and GitHub-style frontmatter conventions, but they pull you into an AST pipeline rather than a simple string split. [^3] [^4]
- If you prefer “build your own” but still want robust YAML handling, `yaml` gives you a fully featured parser and `parseDocument` API while keeping dependencies minimal. You still need to decide and implement the frontmatter fence detection rules yourself. [^6] [^7]
- Obsidian’s guidance suggests frontmatter is a **top-of-file YAML block** used as metadata and is hidden in reading view. This implies that a splitter should strictly require the opening fence to be at the start of the file (possibly after BOM) to align with common editor expectations. [^8]

## Implications or Recommendations
- If the CLI only needs to **separate and count** frontmatter vs content (not to render Markdown), `custom + yaml` is a strong fit and mirrors `remark-mdc`’s approach: a simple fence split plus `yaml.parseDocument`. It keeps dependencies minimal and makes the “what counts as frontmatter” rule explicit in this CLI. [^5] [^6] [^7]
- `gray-matter` remains the lowest-risk drop-in for edge cases; if you want multi-format frontmatter (TOML/JSON) or broader delimiter support later, it can still be swapped in with minimal API changes. [^1]
- If the CLI eventually plans to **parse Markdown syntax** (e.g., MDC components, MDX-like directives) and count words after such transformations, then a remark pipeline with `remark-frontmatter` (and optionally `remark-mdc`) becomes more appropriate, but adds heavier dependencies and ESM-only constraints. [^2] [^3]
- A **custom splitter** is viable if we strictly target GitHub-style YAML frontmatter only and accept edge-case risk (BOM handling, tricky fence collisions, unusual line endings). The ecosystem already encodes these edge cases, so duplicating them may be harder to maintain. [^4]

## Recommendation
- Proceed with **custom + yaml** for the initial implementation, using a `parseMarkdown`-style API (name to be confirmed) that returns `{ frontmatter, content, data, frontmatterType }` to align with `gray-matter`’s split while keeping parsing explicit. This matches the chosen scope (top-of-file frontmatter only) and keeps room for a future swap to `gray-matter` if multi-format frontmatter becomes necessary. [^1] [^5] [^6] [^7]

## Open Questions
- Do we need to support **only YAML** frontmatter or also TOML/JSON? The choice strongly influences whether a simple splitter is sufficient or `gray-matter` is worth the dependency. [^1] [^4]
- Is MDC syntax or a remark pipeline on the roadmap? If not, `remark-mdc` adds a lot of extra surface area for a simple frontmatter/content split. [^2] [^5]

## References
[^1]: [gray-matter (npm)](https://www.npmjs.com/package/gray-matter)
[^2]: [remark-mdc (npm)](https://www.npmjs.com/package/remark-mdc)
[^3]: [remark-frontmatter (npm)](https://www.npmjs.com/package/remark-frontmatter)
[^4]: [micromark-extension-frontmatter (npm)](https://www.npmjs.com/package/micromark-extension-frontmatter)
[^5]: [remark-mdc frontmatter implementation (raw)](https://raw.githubusercontent.com/nuxt-content/remark-mdc/refs/heads/main/src/frontmatter.ts)
[^6]: [eemeli/yaml documentation](https://eemeli.org/yaml/)
[^7]: [eemeli/yaml GitHub repository](https://github.com/eemeli/yaml)
[^8]: [Obsidian YAML frontmatter notes](https://notes.nicolevanderhoeven.com/obsidian-playbook/Using+Obsidian/03+Linking+and+organizing/YAML+Frontmatter)
