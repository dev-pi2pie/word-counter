---
title: "inspect engine content gate info note"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: codex
---

## Goal

Decide how `word-counter inspect --detector wasm --view engine` should behave when `--content-gate ...` is also present, and record the recommended user-facing guidance.

## Key Findings

- The current `engine` view is intentionally raw and does not run the package-level policy path.
  - In `src/detector/wasm.ts`, `view === "engine"` returns the first ambiguous window through `buildEngineInspectResult(...)`.
  - That path reports the diagnostic sample, raw Whatlang result, normalized Whatlang result, and public remap values.
  - It does not compute or disclose `eligibility`, `contentGate`, or final acceptance/fallback decisions.
- The current `pipeline` view is where `contentGate` actually matters.
  - In `src/detector/wasm-resolution.ts`, the detector route policy evaluates both `eligibility` and `contentGate` before deciding whether the engine result is accepted or falls back.
  - This is also the only inspect surface that currently explains why a window was skipped, accepted, or rejected.
- Because the CLI still accepts `--content-gate` together with `--view engine`, users can reasonably infer that the flag should affect engine output.
  - In practice, the same text currently produces the same engine-view output across `default`, `strict`, `loose`, and `off`.
  - The current behavior is technically consistent with the raw-engine contract, but the UX is misleading because the CLI does not explain the limitation at the point of use.
- Making `contentGate` behavior-changing inside engine view would blur the contract.
  - A raw engine view should answer: "what sample was sent to Whatlang, and what did it say?"
  - A policy-aware view should answer: "did the package accept that result, and if not, why?"
  - Folding policy decisions back into engine view would create ambiguity around window selection, skipped windows, and whether engine output should disappear or be annotated when the window is not policy-eligible.

## Implications or Recommendations

- Keep `engine` view raw.
  - Preserve the current contract where engine view reports sample construction and Whatlang output without package-level projection.
- Do not reject `--content-gate` when `--view engine` is requested.
  - Rejection is defensible, but it is stricter than needed and removes a recoverable learning moment.
  - A note is sufficient because the requested command still produces valid raw engine diagnostics.
- Add a cyan informational note when `engine` view is combined with a meaningful content-gate setting.
  - Recommended message:
    - `Info: \`--content-gate\` does not affect \`inspect --view engine\`; engine view shows raw detector output. Use \`--view pipeline\` to inspect eligibility and content-gate restrictions.`
  - Recommended trigger:
    - show the note when the user explicitly passed `--content-gate ...`, including `default`
    - also show the note when the effective mode comes from config or env and resolves to a non-default value
  - Recommended non-trigger:
    - do not show the note for ordinary engine-view runs that simply inherit the default mode with no explicit or effective override
- Update inspect-facing docs to make the split explicit.
  - `--view engine` should be documented as raw engine/sample/remap output only.
  - `--view pipeline` should be documented as the place to inspect `eligibility`, `contentGate`, and fallback reasoning.
  - Help text and README examples should steer users toward pipeline view for policy verification.

## Related Plans

- [docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md](docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md)
- [docs/plans/plan-2026-03-31-inspect-engine-content-gate-info-note-implementation.md](docs/plans/plan-2026-03-31-inspect-engine-content-gate-info-note-implementation.md)

## Related Research

- [docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md](docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md)
- [docs/researches/research-2026-03-25-configurable-content-gate-behavior.md](docs/researches/research-2026-03-25-configurable-content-gate-behavior.md)

## References

[^1]: [docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md](docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md)
[^2]: [docs/schemas/detector-inspector-output-contract.md](docs/schemas/detector-inspector-output-contract.md)
[^3]: [src/detector/wasm.ts](src/detector/wasm.ts)
[^4]: [src/detector/wasm-resolution.ts](src/detector/wasm-resolution.ts)
[^5]: [src/cli/inspect/render.ts](src/cli/inspect/render.ts)
[^6]: [src/cli/inspect/help.ts](src/cli/inspect/help.ts)
