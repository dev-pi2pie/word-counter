---
title: "Fix non-word emoji classification for keycap sequences"
date: 2026-01-16
status: completed
agent: codex
---

## Summary
- Updated emoji classification to include keycap emoji sequences so non-word counts align with user expectations.
- Adjusted emoji detection to require emoji presentation (or VS16 + pictographic) so text-default symbols like © stay symbols unless explicitly emoji-presented.
- Added coverage in tests to verify keycap emoji are classified as emoji rather than symbols or punctuation.
- Added coverage to ensure VS16 forces emoji classification for text-default symbols.

## Rationale
Reviewer feedback highlighted that keycap emoji sequences were excluded from non-word counts because the emoji regex relied solely on `Emoji_Presentation`. This update ensures those sequences are handled consistently.
Follow-up adjustments were needed after review to keep text-default symbols from being double-counted as emoji unless explicitly emoji-presented, while still honoring VS16.
