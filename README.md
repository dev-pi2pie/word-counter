# Word Counter

Locale-aware word counting powered by the Web API [`Intl.Segmenter`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter). The script automatically detects the primary writing system for each portion of the input, segments the text with the matching locale, and reports word totals per language.

## How It Works

- The runtime inspects each character's Unicode script to infer its likely locale (e.g., `und-Latn`, `zh-Hans`, `ja`).
- Adjacent characters that share the same locale are grouped into a chunk.
- Each chunk is counted with `Intl.Segmenter` at `granularity: "word"`, caching segmenters to avoid re-instantiation.
- Per-locale counts are summed into a overall total and printed to stdout.

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

### From GitHub Packages

If your scope is configured to use GitHub Packages:

```bash
# ~/.npmrc
@dev-pi2pie:registry=https://npm.pkg.github.com
```

```bash
npm install -g @dev-pi2pie/word-counter@latest
```

If your scope is configured to use npmjs instead, the same scoped package name
will resolve from npmjs.com (see the npm registry section above).

> [!note]
> **npm** may show newer releases (for example, `v0.0.6`) while GitHub Packages still lists `v0.0.5`.
> This is historical; releases kept in sync starting with `v0.0.6`.

## Usage

Once installed (via `npm link`, npm registry, or GitHub Packages), you can use the CLI directly:

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

Hint a locale for ambiguous Latin text (ASCII-heavy content):

```bash
word-counter --latin-locale en "Hello world"
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

## Library Usage

The package exports can be used after installing from GitHub Packages or linking locally with `npm link`.

### ESM

```js
import wordCounter, {
  countWordsForLocale,
  countSections,
  parseMarkdown,
  segmentTextByLocale,
  showSingularOrPluralWord,
} from "@dev-pi2pie/word-counter";

wordCounter("Hello world", { latinLocaleHint: "en" });
wordCounter("Hi 👋, world!", { nonWords: true });
```

### CJS

```js
const wordCounter = require("@dev-pi2pie/word-counter");
const {
  countWordsForLocale,
  countSections,
  parseMarkdown,
  segmentTextByLocale,
  showSingularOrPluralWord,
} = wordCounter;

wordCounter("Hello world", { latinLocaleHint: "en" });
wordCounter("Hi 👋, world!", { nonWords: true });
```

### Export Summary

#### Core API

| Export                | Kind     | Notes                                              |
| --------------------- | -------- | -------------------------------------------------- |
| `default`             | function | `wordCounter(text, options?) -> WordCounterResult` |
| `wordCounter`         | function | Alias of the default export.                       |
| `countWordsForLocale` | function | Low-level helper for per-locale counts.            |
| `segmentTextByLocale` | function | Low-level helper for locale-aware segmentation.    |

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

| Export                 | Kind | Notes                                     |
| ---------------------- | ---- | ----------------------------------------- |
| `WordCounterOptions`   | type | Options for the `wordCounter` function.   |
| `WordCounterResult`    | type | Returned by `wordCounter`.                |
| `WordCounterBreakdown` | type | Breakdown payload in `WordCounterResult`. |
| `WordCounterMode`      | type | `"chunk" \| "segments" \| "collector"`.   |
| `NonWordCollection`    | type | Non-word segments + counts payload.       |

### Display Modes

Choose a breakdown style with `--mode` (or `-m`):

- `chunk` (default) – list each contiguous locale block in order of appearance.
- `segments` – show the actual wordlike segments used for counting.
- `collector` – aggregate counts per locale regardless of text position.

Examples:

```bash
# chunk mode (default)
word-counter "飛鳥 bird 貓 cat; how do you do?"

# show captured segments
word-counter --mode segments "飛鳥 bird 貓 cat; how do you do?"

# aggregate per locale
word-counter -m collector "飛鳥 bird 貓 cat; how do you do?"
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

> [!Note]
> Text-default symbols (e.g. ©) count as `symbols` unless explicitly emoji-presented (e.g. ©️ with VS16).

## Locale Detection Notes (Migration)

- Ambiguous Latin text now uses `und-Latn` instead of defaulting to `en`.
- Use `--mode chunk`/`--mode segments` or `--format json` to see the exact locale assigned to each chunk.
- Regex/script-only detection cannot reliably identify English vs. other Latin-script languages; 100% certainty requires explicit metadata (document language tags, user-provided locale, headers) or a language-ID model.
- Provide a hint with `--latin-locale <locale>` or `latinLocaleHint` when you know the intended Latin language.

## Testing

Run the build before tests so the CJS interop test can load the emitted
`dist/cjs/index.cjs` bundle:

```bash
bun run build
bun test
```

## Sample Inputs

Try the following mixed-locale phrases to see how detection behaves:

- `"Hello world 你好世界"`
- `"Bonjour le monde こんにちは 세계"`
- `"¡Hola! مرحبا Hello"`

Each run prints the total word count plus a per-locale breakdown, helping you understand how multilingual text is segmented.

## License

This project is licensed under the MIT License — see the [LICENSE](https://github.com/dev-pi2pie/word-counter/blob/main/LICENSE) file for details.
