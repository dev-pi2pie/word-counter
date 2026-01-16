---
title: "Fix non-word emoji classification for keycap sequences"
date: 2026-01-16
status: completed
agent: codex
---

## Summary
- Updated emoji classification to include keycap emoji sequences so non-word counts align with user expectations.
- Added coverage in tests to verify keycap emoji are classified as emoji rather than symbols or punctuation.

## Rationale
Reviewer feedback highlighted that keycap emoji sequences were excluded from non-word counts because the emoji regex relied solely on `Emoji_Presentation`. This update ensures those sequences are handled consistently.
