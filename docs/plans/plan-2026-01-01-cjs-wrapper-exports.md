---
title: "CJS wrapper exports for mixed default/named entry"
date: 2026-01-01
status: completed
agent: Codex
---

# Goal

Provide a CJS-friendly wrapper so `require("word-counter")` returns the default
export directly while still exposing named exports, and avoid the mixed-exports
warning in the CJS build.

# Scope

- Add a CJS wrapper entry that assigns `module.exports = wordCounter` and
  attaches named exports as properties.
- Update build config and package exports to point CJS to the wrapper.
- Keep ESM entry as-is for default + named exports.
- Document the CJS usage and any interop notes.

# Non-Goals

- Changing the public API shape for ESM consumers.
- Removing default or named exports.

# Plan

1. Inspect current build outputs and entry wiring (`src/index.ts`, tsdown config,
   `package.json` exports).
2. Add a new CJS entry file and wire it into the build.
3. Update `package.json` exports for CJS to use the wrapper.
4. Adjust docs/README with CJS usage example.
5. Run build/tests (if requested) and confirm no mixed-exports warning for CJS.

# Risks

- Incorrect wrapper wiring could break CJS consumers or types resolution.
- CJS wrapper must stay in sync with named exports.
