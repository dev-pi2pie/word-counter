---
title: "Section Display Improvements"
created-date: 2026-01-15
status: completed
agent: codex
---

## Goal
Improve CLI section output readability for `--section` modes by clarifying labels (avoid collision with frontmatter keys) and optionally using color emphasis.

## Scope
- Labeling: ensure each section line clearly identifies the section as a total, even for per-key sections.
- Visual emphasis: use `picocolors` to highlight section labels without affecting raw/json output.

## Plan
1. Define label format:
   - Use bracketed tags to clarify source, e.g. `[Frontmatter] <key> (total)` and `[Content] (total)`.
   - Drop the literal “Section” label to avoid collisions with frontmatter keys.
2. Update renderer:
   - Apply the label format in `renderStandardSectionedResult`.
   - Ensure the format only affects `standard` output.
3. Add optional color accents:
   - Highlight `Section` labels (e.g., `pc.cyan` or `pc.bold`) while keeping text readable in plain terminals.
4. Verify against sample runs:
   - `--section split`, `--section per-key`, `--section split-per-key`.
   - Ensure no confusion when a frontmatter key is literally `content`.

## Acceptance Criteria
- All section lines include a clear `(total)` or `(frontmatter)` hint.
- `standard` output is easier to scan; `raw` and `json` remain unchanged.
- No regression to locale breakdown outputs.
