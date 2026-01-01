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

### Plan Documents

Location:
```text
docs/plans/plan-YYYY-MM-DD-<short-title>.md
```

Notes:
- Do not create or edit `docs/plan.md`.
- Use the date for when the plan is created and a short, kebab-case title.

Front-matter format:
```yaml
---
title: "<plan title>"
date: YYYY-MM-DD
status: draft | active | completed
agent: <agent name>
---
```

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
date: YYYY-MM-DD
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
- Record *what changed* and *why*
- Avoid repeating information already in other documents
- Assume future agents will read this without prior context

---

## Philosophy

> This file exists to reduce guesswork for the next agent.



