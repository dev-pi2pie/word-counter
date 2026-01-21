---
title: "Whitespace and tab counting options"
date: 2026-01-21
status: draft
agent: codex
---

## Goal

Capture options for counting whitespace and tab characters (and other misc separators) in the word counter while preserving current behavior by default.

## Key Findings

- Today, counts are derived from `Intl.Segmenter` in word granularity; non-word segments are only tallied when explicitly collecting emoji/symbol/punctuation. Whitespace and tabs are ignored in totals.
- Grapheme counting (`Intl.Segmenter` with `granularity: "grapheme"`) can provide a consistent, emoji-safe path to count whitespace/tab clusters when explicitly enabled.
- Any whitespace/tab counting should be opt-in to avoid breaking current totals and user expectations.

## Option Ideas (CLI + API)

### 1) Explicit flags for whitespace
- CLI: `--whitespace` or `--include-whitespace`
- API: `includeWhitespace: true`
- Behavior: add whitespace (including tabs/newlines) to totals, optionally tracked in breakdown.

### 2) Granular counters without changing totals
- CLI: `--whitespace-breakdown` (or piggyback on `--non-words`)
- API: `whitespaceBreakdown: true`
- Behavior: totals stay the same; JSON adds a `whitespace` object (counts for spaces, tabs, newlines, other).

### 3) Extended non-words bucket
- CLI: `--misc` or `--non-words --include-whitespace`
- API: `nonWords: true, includeWhitespace: true`
- Behavior: adds `whitespace` counts alongside emoji/symbol/punctuation; totals optionally include whitespace if requested.

### 4) Mode-level behavior
- CLI: `--mode char` plus `--include-whitespace`
- API: `mode: "char", includeWhitespace: true`
- Behavior: character totals include whitespace, while word modes remain unchanged.

## JSON Shape Ideas

### A) Add a top-level field when enabled
```
{
  "total": 12,
  "breakdown": { ... },
  "whitespace": {
    "spaces": 6,
    "tabs": 2,
    "newlines": 1,
    "other": 0,
    "total": 9
  }
}
```

### B) Extend `nonWords` when enabled
```
{
  "breakdown": {
    "mode": "collector",
    "items": [...],
    "nonWords": {
      "emoji": [...],
      "symbols": [...],
      "punctuation": [...],
      "whitespace": { "spaces": 6, "tabs": 2, "newlines": 1, "other": 0 },
      "counts": { ... }
    }
  }
}
```

### C) Per-chunk field in `char` mode only
```
{ "mode": "char", "items": [ { "locale": "en", "chars": 10, "whitespace": { ... } } ] }
```

## Recommendations

- Prefer **opt-in** counting to preserve current totals.
- Add a **simple flag** (`--include-whitespace` / `includeWhitespace`) and a **lightweight JSON field** so users can opt into counting without changing default behavior.
- Keep the first version minimal: total whitespace count + tabs/spaces/newlines; other whitespace can be grouped as `other`.

## Open Questions

- Should whitespace be included in totals only for `char` mode, or for all modes when enabled?
- Is a separate `--tabs` flag useful, or should tabs be a sub-count under whitespace?
- Should whitespace appear under `nonWords`, or as a separate top-level field?

## Related Plans

None.

## References

- `src/wc/analyze.ts` and `src/wc/segmenter.ts` for segmentation behavior.
- `src/wc/wc.ts` for total aggregation logic.
