---
title: "Address detector review findings with regression tests"
created-date: 2026-03-25
modified-date: 2026-03-25
status: completed
agent: Codex
---

## Summary

- Add a direct regression test for the WASM `noCandidate` fallback branch after engine execution.
- Add a direct regression test for the empty WASM pipeline inspect branch.
- Preserve detector behavior and keep changes limited to test coverage.

## Rationale

- The `noCandidate` regression test uses an Indonesian sample:
  - `Ini adalah kalimat bahasa Indonesia yang cukup panjang untuk menguji cabang fallback detektor wasm.`
- This sample is appropriate because the current WASM remap contract does not include `ind` in the Latin language remap table.
- In the current implementation, `src/detector/whatlang-map.ts` only remaps the following Latin detector outputs:
  - `cat`, `ces`, `dan`, `deu`, `eng`, `fin`, `fra`, `hun`, `ita`, `lat`, `nld`, `pol`, `por`, `ron`, `spa`, `swe`, `tur`
- A runtime probe during implementation confirmed that the current engine reports the Indonesian sample as:
  - `lang: "ind"`
  - `script: "Latin"`
  - remapped tag: `null`
- That makes the sample a direct fit for the `noCandidate` branch rather than an inferred or synthetic fallback.

## Verification

- Ran `bun test test/detector-inspect.test.ts test/word-counter-detector.test.ts`.
- Ran `bun run type-check`.

## References

- `src/detector/whatlang-map.ts`
- `test/detector-inspect.test.ts`
- `test/word-counter-detector.test.ts`

## Related Plans

- `docs/plans/plan-2026-03-25-typescript-structure-modularization.md`
