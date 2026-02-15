# Word Counter

Locale-aware word counting powered by the Web API [`Intl.Segmenter`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter). The script automatically detects the primary writing system for each portion of the input, segments the text with matching BCP 47 locale tags, and reports word totals per locale.

## How It Works

- The runtime inspects each character's Unicode script to infer its likely locale tag (e.g., `und-Latn`, `zh-Hani`, `ja`).
- Adjacent characters that share the same locale tag are grouped into a chunk.
- Each chunk is counted with `Intl.Segmenter` at `granularity: "word"`, caching segmenters to avoid re-instantiation.
- Per-locale counts are summed into a overall total and printed to stdout.

## Locale vs Language Code

- Output keeps the field name `locale` for compatibility.
- In this project, locale values are BCP 47 tags and are often language/script focused (for example: `en`, `und-Latn`, `zh-Hani`) rather than region-specific tags (for example: `en-US`, `zh-TW`).
- Default detection prefers language/script tags to avoid incorrect region assumptions.
- You can still provide region-specific locale tags through hint flags when needed.

## Installation

### For Development

Clone the repository and set up locally:

```bash
git clone https://github.com/dev-pi2pie/word-counter.git
cd word-counter
bun install
bun run build
npm link
```

After linking, you can use the `word-counter` command globally:

```bash
word-counter "Hello 世界 안녕"
```

To use the linked package inside another project:

```bash
npm link @dev-pi2pie/word-counter
```

To uninstall the global link:

```bash
npm unlink --global @dev-pi2pie/word-counter
```

### From npm Registry (npmjs.com)

```bash
npm install -g @dev-pi2pie/word-counter@latest
```

## Usage

Once installed (via `npm link` or the npm registry), you can use the CLI directly:

```bash
word-counter "Hello 世界 안녕"
```

Alternatively, run the built CLI with Node:

```bash
node dist/esm/bin.mjs "Hello 世界 안녕"
```

You can also pipe text:

```bash
echo "こんにちは world مرحبا" | word-counter
```

Hint a locale tag for ambiguous Latin text (ASCII-heavy content):

```bash
word-counter --latin-language en "Hello world"
word-counter --latin-tag en "Hello world"
```

Hint a locale tag for Han text fallback:

```bash
word-counter --han-language zh-Hant "漢字測試"
word-counter --han-tag zh-Hans "汉字测试"
```

Collect non-word segments (emoji, symbols, punctuation):

```bash
word-counter --non-words "Hi 👋, world!"
```

When enabled, `total` includes words + non-words (emoji, symbols, punctuation).

Or read from a file:

```bash
word-counter --path ./fixtures/sample.txt
```

`--path` accepts any readable text-like file, including empty or whitespace-only files.
Such files are treated as valid inputs and contribute zero words by default.

### Batch Counting

Process multiple files by repeating `--path`:

```bash
word-counter --path ./docs/a.md --path ./docs/b.txt
```

Pass a directory path to scan files recursively (default):

```bash
word-counter --path ./examples/test-case-multi-files-support
```

Show per-file results plus merged summary:

```bash
word-counter --path ./examples/test-case-multi-files-support --per-file
```

Batch progress is auto-enabled for multi-file standard output and is transient:

```bash
word-counter --path ./examples/test-case-multi-files-support
word-counter --path ./examples/test-case-multi-files-support --no-progress
```

Progress updates follow this style while running:

```text
Counting files [██████░░░░░░░░░░░░]  31%  37/120 elapsed 00:01.2
Counting files [███████████░░░░░░░]  58%  70/120 elapsed 00:02.8
Counting files [████████████████████] 100% 120/120 elapsed 00:04.1
```

Single-input runs do not show progress by default. Progress is also suppressed in `--format raw` and `--format json`.

Restrict directory scanning extensions:

```bash
word-counter --path ./examples/test-case-multi-files-support --include-ext .md,.mdx
word-counter --path ./examples/test-case-multi-files-support --include-ext .md,.txt --exclude-ext .txt
```

Skip diagnostics are debug-gated. By default, skipped-file details are hidden.
Use `--debug` to print skipped-file diagnostics to `stderr`:

```bash
word-counter --path ./examples/test-case-multi-files-support --debug
```

With `--debug`, batch resolution/progress lifecycle diagnostics are emitted as structured `[debug]` entries on `stderr` (stdout remains clean).
In `--debug` mode, the final progress line is kept visible (not auto-cleared).

## Library Usage

The package exports can be used after installing from the npm registry or linking locally with `npm link`.

### ESM

```js
import wordCounter, {
  countCharsForLocale,
  countWordsForLocale,
  countSections,
  parseMarkdown,
  segmentTextByLocale,
  showSingularOrPluralWord,
} from "@dev-pi2pie/word-counter";

wordCounter("Hello world", { latinLanguageHint: "en" });
wordCounter("Hello world", { latinTagHint: "en" });
wordCounter("漢字測試", { hanTagHint: "zh-Hant" });
wordCounter("Hi 👋, world!", { nonWords: true });
wordCounter("Hi 👋, world!", { mode: "char", nonWords: true });
wordCounter("Hi\tthere\n", { nonWords: true, includeWhitespace: true });
countCharsForLocale("👋", "en");
```

Note: `includeWhitespace` only affects results when `nonWords: true` is enabled.

Sample output (with `nonWords: true` and `includeWhitespace: true`):

```json
{
  "total": 4,
  "counts": { "words": 2, "nonWords": 2, "total": 4 },
  "breakdown": {
    "mode": "chunk",
    "items": [
      {
        // ...
        "words": 2,
        "nonWords": {
          "emoji": [],
          "symbols": [],
          "punctuation": [],
          "counts": { "emoji": 0, "symbols": 0, "punctuation": 0, "whitespace": 2 },
          "whitespace": { "spaces": 0, "tabs": 1, "newlines": 1, "other": 0 }
        }
      }
    ]
  }
}
```

### CJS

```js
const wordCounter = require("@dev-pi2pie/word-counter");
const {
  countCharsForLocale,
  countWordsForLocale,
  countSections,
  parseMarkdown,
  segmentTextByLocale,
  showSingularOrPluralWord,
} = wordCounter;

wordCounter("Hello world", { latinLanguageHint: "en" });
wordCounter("Hello world", { latinTagHint: "en" });
wordCounter("漢字測試", { hanTagHint: "zh-Hant" });
wordCounter("Hi 👋, world!", { nonWords: true });
wordCounter("Hi 👋, world!", { mode: "char", nonWords: true });
wordCounter("Hi\tthere\n", { nonWords: true, includeWhitespace: true });
countCharsForLocale("👋", "en");
```

Note: `includeWhitespace` only affects results when `nonWords: true` is enabled.

Sample output (with `nonWords: true` and `includeWhitespace: true`):

```json
{
  "total": 4,
  "counts": { "words": 2, "nonWords": 2, "total": 4 },
  "breakdown": {
    "mode": "chunk",
    "items": [
      {
        // ...
        "words": 2,
        "nonWords": {
          "emoji": [],
          "symbols": [],
          "punctuation": [],
          "counts": { "emoji": 0, "symbols": 0, "punctuation": 0, "whitespace": 2 },
          "whitespace": { "spaces": 0, "tabs": 1, "newlines": 1, "other": 0 }
        }
      }
    ]
  }
}
```

### Export Summary

#### Core API

| Export                | Kind     | Notes                                              |
| --------------------- | -------- | -------------------------------------------------- |
| `default`             | function | `wordCounter(text, options?) -> WordCounterResult` |
| `wordCounter`         | function | Alias of the default export.                       |
| `countCharsForLocale` | function | Low-level helper for per-locale char counts.       |
| `countWordsForLocale` | function | Low-level helper for per-locale counts.            |
| `segmentTextByLocale` | function | Low-level helper for locale-tag segmentation.      |

#### Markdown Helpers

| Export          | Kind     | Notes                                         |
| --------------- | -------- | --------------------------------------------- |
| `parseMarkdown` | function | Parses Markdown and detects frontmatter.      |
| `countSections` | function | Counts words by frontmatter/content sections. |

#### Utility Helpers

| Export                     | Kind     | Notes                          |
| -------------------------- | -------- | ------------------------------ |
| `showSingularOrPluralWord` | function | Formats singular/plural words. |

#### Types

| Export                 | Kind | Notes                                             |
| ---------------------- | ---- | ------------------------------------------------- |
| `WordCounterOptions`   | type | Options for the `wordCounter` function.           |
| `WordCounterResult`    | type | Returned by `wordCounter`.                        |
| `WordCounterBreakdown` | type | Breakdown payload in `WordCounterResult`.         |
| `WordCounterMode`      | type | `"chunk" \| "segments" \| "collector" \| "char"`. |
| `NonWordCollection`    | type | Non-word segments + counts payload.               |

### Display Modes

Choose a breakdown style with `--mode` (or `-m`):

- `chunk` (default) – list each contiguous locale block in order of appearance.
- `segments` – show the actual wordlike segments used for counting.
- `collector` – aggregate counts per locale regardless of text position.
- `char` – count grapheme clusters (user-perceived characters) per locale.

Aliases are normalized for CLI + API:

- `chunk`, `chunks`
- `segments`, `segment`, `seg`
- `collector`, `collect`, `colle`
- `char`, `chars`, `character`, `characters`

Examples:

```bash
# chunk mode (default)
word-counter "飛鳥 bird 貓 cat; how do you do?"

# show captured segments
word-counter --mode segments "飛鳥 bird 貓 cat; how do you do?"

# aggregate per locale
word-counter -m collector "飛鳥 bird 貓 cat; how do you do?"

# grapheme-aware character count
word-counter -m char "Hi 👋, world!"
```

### Section Modes (Frontmatter)

Use `--section` to control which parts of a markdown document are counted:

- `all` (default) – count the whole file (fast path, no section split).
- `split` – count frontmatter and content separately.
- `frontmatter` – count frontmatter only.
- `content` – count content only.
- `per-key` – count frontmatter per key (frontmatter only).
- `split-per-key` – per-key frontmatter counts plus a content total.

Supported frontmatter formats:

- YAML fenced with `---`
- TOML fenced with `+++`
- JSON fenced with `;;;` or a top-of-file JSON object (`{ ... }`)

Examples:

```bash
word-counter --section split -p examples/yaml-basic.md
word-counter --section per-key -p examples/yaml-basic.md
word-counter --section split-per-key -p examples/yaml-basic.md
```

JSON output includes a `source` field (`frontmatter` or `content`) to avoid key collisions:

```bash
word-counter --section split-per-key --format json -p examples/yaml-content-key.md
```

Example (trimmed):

```json
{
  "section": "split-per-key",
  "frontmatterType": "yaml",
  "total": 7,
  "items": [
    { "name": "content", "source": "frontmatter", "result": { "total": 3 } },
    { "name": "content", "source": "content", "result": { "total": 4 } }
  ]
}
```

### Output Formats

Select how results are printed with `--format`:

- `standard` (default) – total plus per-locale breakdown.
- `raw` – only the total count (single number).
- `json` – machine-readable output; add `--pretty` for indentation.

Examples:

```bash
word-counter --format raw "Hello world"
word-counter --format json --pretty "Hello world"
```

### Non-Word Collection

Use `--non-words` (or `nonWords: true` in the API) to collect emoji, symbols, and punctuation as separate categories. When enabled, the `total` includes both words and non-words.

```bash
word-counter --non-words "Hi 👋, world!"
```

Example: `total = words + emoji + symbols + punctuation` when enabled.
Standard output labels this as `Total count` to reflect the combined total; `--format raw` still prints a single number.

Include whitespace-like characters in the non-words bucket (API: `includeWhitespace: true`):

```bash
word-counter --include-whitespace "Hi\tthere\n"
word-counter --misc "Hi\tthere\n"
```

In the CLI, `--include-whitespace` implies with `--non-words` (same behavior as `--misc`). `--non-words` alone does not include whitespace. When enabled, whitespace counts appear under `nonWords.whitespace`, and `total = words + nonWords` (emoji + symbols + punctuation + whitespace). JSON output also includes top-level `counts` when `nonWords` is enabled. See `docs/schemas/whitespace-categories.md` for how whitespace is categorized.

Example JSON (trimmed):

```json
{
  "total": 5,
  "counts": { "words": 2, "nonWords": 3, "total": 5 },
  "breakdown": {
    "mode": "chunk",
    "items": [
      {
        "locale": "und-Latn",
        "words": 2,
        "nonWords": {
          "counts": { "emoji": 0, "symbols": 0, "punctuation": 0, "whitespace": 3 },
          "whitespace": { "spaces": 1, "tabs": 1, "newlines": 1, "other": 0 }
        }
      }
    ]
  }
}
```

> [!Note]
> Text-default symbols (e.g. ©) count as `symbols` unless explicitly emoji-presented (e.g. ©️ with VS16).

## Locale Tag Detection Notes (Migration)

- Ambiguous Latin text uses `und-Latn` unless a Latin hint is provided.
- Han-script fallback uses `zh-Hani` by default because regex script checks cannot natively distinguish `zh-Hans` vs `zh-Hant`.
- Use `--mode chunk`/`--mode segments` or `--format json` to see the exact locale tag assigned to each chunk.
- Regex/script-only detection cannot reliably identify English vs. other Latin-script languages; 100% certainty requires explicit metadata (document language tags, user-provided locale, headers) or a language-ID model.
- Use `--latin-language <tag>` or `--latin-tag <tag>` for ambiguous Latin text.
- Use `--han-language <tag>` or `--han-tag <tag>` for Han-script fallback.
- `--latin-locale` remains supported as a legacy alias for now and is planned for future deprecation.

## Breaking Changes Notes

- Planned deprecations and migration notes are tracked in `docs/breaking-changes-notes.md`.

## Testing

Run the build before tests so the CJS interop test can load the emitted
`dist/cjs/index.cjs` bundle:

```bash
bun run build
bun test
```

## Sample Inputs

Try the following mixed-language phrases to see how detection behaves:

- `"Hello world 你好世界"`
- `"Bonjour le monde こんにちは 세계"`
- `"¡Hola! مرحبا Hello"`

Each run prints the total word count plus a per-locale breakdown, helping you understand how multilingual text is segmented.

## License

This project is licensed under the MIT License — see the [LICENSE](https://github.com/dev-pi2pie/word-counter/blob/main/LICENSE) file for details.
