---
title: "default latin regexp immutability fix"
created-date: 2026-02-18
status: completed
agent: Codex
---

## Goal

Close the immutability gap in exported `DEFAULT_LATIN_HINT_RULES` where nested `RegExp` instances could still be mutated at runtime.

## Summary

- Replaced built-in default hint patterns with immutable string regex sources.
- Kept public API compatibility (`LatinHintRule.pattern` remains `string | RegExp`).
- Added regression coverage to guard against `RegExp.compile()`-style mutation affecting default detection.

## Changes

- `src/wc/latin-hints.ts`
  - Switched default pattern values from `RegExp` literals to string patterns.
- `test/word-counter.test.ts`
  - Extended immutable-export test to cover the `RegExp.compile` mutation vector and verify `"Über"` still resolves to `de`.

## Validation

- `bun test test/word-counter.test.ts test/command.test.ts` (pass)
- `bun run type-check` (pass)
- README usage checks:
  - `bun run src/bin.ts --format json --latin-hint 'pl=[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' 'Zażółć gęślą jaźń'`
  - `bun run src/bin.ts --format json --latin-hints-file ./examples/latin-hints.json 'Zażółć Știință Iğdır'`
  - `bun run src/bin.ts --format json --no-default-latin-hints --latin-hint 'pl=[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' 'Zażółć'`
