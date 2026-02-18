---
title: "WASM Language Detector Spike for Ambiguous Script Routes"
created-date: 2026-02-18
status: draft
agent: Codex
---

## Goal
Define a practical, low-risk route to add optional WASM-based language detection for ambiguous script buckets (`und-Latn`, `und-Hani`) while preserving current fast regex/script behavior.

## Milestone Goal
Deliver a spike decision for `v0.1.x`: whether to ship a WASM detector path behind an opt-in flag.

## Context
- Current pipeline is script-first and fast.
- Ambiguous Latin and Han runs can remain broad tags (`und-*`) without stronger evidence.
- This is acceptable by design, but some users want better automatic resolution.

## Key Findings
- `wasm-pack build` supports a Node target (`--target nodejs`), which fits this repo's Node runtime contract. [^1][^2]
- `wasm-bindgen` includes deployment guidance for Node.js environments. [^3]
- `whatlang` provides language + script + confidence/reliability signals, and is actively documented on docs.rs. [^4][^5]
- `whichlang` is very fast, but docs coverage is currently minimal on docs.rs; integration confidence depends more on spike validation than docs quality. [^6][^7]
- `cld3-asm` exists as a ready-made JS/WASM package, but npm registry metadata shows the latest publish (`3.1.0`) on 2022-11-28, so maintenance freshness is a risk. [^8]

## Recommended Pipeline
1. Keep current regex/script gate as Step 0 (`und-Latn`, `und-Hani`, etc).
2. Run WASM detection only for ambiguous runs and only when text length is above a minimum threshold.
3. Keep this route opt-in first (for example `--detector wasm`) to avoid changing default performance/behavior.
4. Add provenance metadata in JSON output to show resolution source (for example `script`, `hint`, `wasm`).

## Candidate Approaches

### Option A: Rust Crate + wasm-pack (Preferred for control)
- Build a thin Rust wrapper and compile with `wasm-pack --target nodejs`.
- Candidate crate priority:
  - `whatlang` first (better structured output for script/confidence)
  - `whichlang` as performance-oriented fallback candidate
- Pros:
  - full control over model behavior and output schema
  - clearer long-term ownership
- Cons:
  - higher initial build/tooling work

### Option B: `cld3-asm` npm package (Fastest adoption, higher risk)
- Use package directly in Node.
- Pros:
  - minimal initial engineering work
- Cons:
  - dependency freshness risk due to older publish timestamp
  - less control over internals and maintenance direction

## Repo-Fit Notes
- Project targets Node.js `>=20` and bundles TS with `tsdown`; optional detector loading should be lazy to avoid startup regression for default path.
- CLI and library behavior should remain unchanged unless detector mode is explicitly enabled.

## Proposed Spike Plan
1. Build a minimal detector interface in TS:
   - input: text chunk + wide tag
   - output: `{ tag, confidence?, reliable?, source: "wasm" }`
2. Implement one Rust/WASM prototype using `whatlang` with `wasm-pack --target nodejs`.
3. Add threshold/routing policy:
   - only call detector for `und-Latn` / `und-Hani`
   - skip very short chunks
4. Add benchmark harness:
   - regex-only baseline
   - regex + WASM route on ambiguous corpora
5. Decide go/no-go based on:
   - accuracy lift on representative samples
   - latency overhead budget
   - packaging/developer workflow complexity

## Success Criteria
- No regression in default mode.
- Opt-in mode improves ambiguous-tag resolution quality on test corpora.
- Build/test workflow remains stable in Node/Bun CI.

## Risks
- Short text remains inherently hard for statistical LID.
- Mixed-language chunks may still need fallback to `und-*`.
- WASM packaging can complicate release pipelines if not isolated behind lazy loading.

## Implications / Recommendations
- Proceed with a Rust/WASM spike first (Option A), starting with `whatlang`.
- Keep detector optional in `v0.1.x`; do not replace the current default route yet.
- Reassess `cld3-asm` only if spike cost is too high and maintenance risk is acceptable.

## Open Questions
- What minimum chunk length should gate WASM detection for acceptable precision?
- Should low-confidence detector results be emitted as `und-*` instead of forced language tags?

## Related Plans
- `docs/plans/plan-2026-01-02-wc-refactor-locale-research.md`
- `docs/plans/plan-2026-01-14-latin-ambiguous-locale.md`

## Related Research
- `docs/research-2026-01-02-language-detection.md`
- `docs/research-2026-02-18-latin-custom-hints-v2.md`

## References
[^1]: https://rustwasm.github.io/docs/wasm-pack/commands/build.html
[^2]: https://docs.rs/wasm-pack/latest/wasm_pack/command/build/enum.Target.html
[^3]: https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html
[^4]: https://docs.rs/whatlang/latest/whatlang/
[^5]: https://raw.githubusercontent.com/greyblake/whatlang-rs/master/README.md
[^6]: https://raw.githubusercontent.com/quickwit-oss/whichlang/main/README.md
[^7]: https://docs.rs/whichlang/latest/whichlang/
[^8]: https://registry.npmjs.org/cld3-asm
