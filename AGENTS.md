# AGENTS.md

This document provides essential context for any agent working in this repository.

---

## Development Environment

- Project type: CLI application and package utils functions
- Development tooling: Bun
- Bundling tooling: Tsdown
- Runtime target: Node.js
- Language: TypeScript

Assumptions:
- Code may use Bun for development speed and tooling
- Runtime behavior MUST remain compatible with Node.js

---

## Documentation Conventions

All meaningful agent work SHOULD be documented.

### Date Policy

- Use `created-date` for when the document first begins.
- Use `modified-date` only when a later update is made.
- Keep `created-date` unchanged after initial creation.
- All dates are UTC calendar dates in `YYYY-MM-DD`.
- Do not include time-of-day or timezone suffix in front-matter date fields.
- When local and UTC dates differ, use the UTC date.

### Plan Documents

Location:

```text
docs/plans/plan-YYYY-MM-DD-<short-title>.md
```

Notes:

- Do not create or edit `docs/plan.md`.
- Use the creation date and a short, kebab-case title.

Front-matter format:

```yaml
---
title: "<plan title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | active | completed
agent: <agent name>
---
```

---

### Research Documents

Use research docs for exploratory work that is not yet ready for a plan but may inform one.

Location:

```text
docs/research-YYYY-MM-DD-<short-title>.md
```

Notes:

- Use the creation date and a short, kebab-case title.
- Keep scope focused on a single topic or question.
- If research becomes actionable, create a plan doc and link to it.

Front-matter format:

```yaml
---
title: "<research title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | in-progress | completed
agent: <agent name>
---
```

Suggested sections:

- Goal
- Key Findings
- Implications or Recommendations
- Open Questions (optional)
- References (use footnote-style links)

Traceability:

- Research docs should include a short "Related Plans" section when applicable, with links to plan docs.
- Plan docs should include a short "Related Research" section when applicable, with links to research docs.
- Use those exact section titles for consistency.
- Omit the section if there are no relevant links.

---

### Job Records

For concrete tasks or implementations, create a job record.

Location:

```text
docs/plans/jobs/YYYY-MM-DD-<short-title>.md
```

Front-matter format:

```yaml
---
title: "<job title>"
created-date: YYYY-MM-DD
modified-date: YYYY-MM-DD # optional
status: draft | in-progress | completed | blocked
agent: <agent name>
---
```

---

### Status Meanings

- `draft` — idea or exploration, not executed
- `active` — current plan being worked on
- `in-progress` — task implementation ongoing
- `completed` — work finished
- `blocked` — waiting on decision or dependency

---

## Writing Guidelines

- Prefer clarity over verbosity
- Record _what changed_ and _why_
- Avoid repeating information already in other documents
- Assume future agents will read this without prior context

---

## Philosophy

> This file exists to reduce guesswork for the next agent.
