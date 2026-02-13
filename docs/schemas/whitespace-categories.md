---
title: "Whitespace Categories (nonWords.whitespace)"
created-date: 2026-02-02
---

# Whitespace Categories (nonWords.whitespace)

This document explains how whitespace-like characters are categorized when
`includeWhitespace` (or CLI `--include-whitespace` / `--misc`) is enabled.

## Overview

Whitespace is counted only when non-words are collected. Counts appear under
`nonWords.whitespace` and roll up into `nonWords.counts.whitespace`.

## Categories

- `spaces`: ASCII space only (`U+0020`).
- `tabs`: Horizontal tab only (`U+0009`).
- `newlines`: Line breaks only (`U+000A LF`, `U+000D CR`, `U+2028 LS`, `U+2029 PS`).
- `other`: Any other character matched by the Unicode whitespace class (`\s`).

## Examples

- Full-width space (`U+3000`) -> `other`
- No-break space (`U+00A0`) -> `other`
- Thin spaces (`U+2000..U+200A`) -> `other`

## Notes

- Only segments that are not word-like are examined for whitespace.
- The `other` category is intentionally broad to avoid missing uncommon
  whitespace code points.
