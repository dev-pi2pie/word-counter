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

Or read from a file:

```bash
word-counter --path ./fixtures/sample.txt
```

## Library Usage

The package exports can be used after installing from GitHub Packages or linking locally with `npm link`.

### ESM

```js
import wordCounter, { countWordsForLocale, segmentTextByLocale } from "@dev-pi2pie/word-counter";
```

### CJS

```js
const wordCounter = require("@dev-pi2pie/word-counter");
const { countWordsForLocale, segmentTextByLocale, showSingularOrPluralWord } = wordCounter;
```

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

## Locale Detection Notes (Migration)

- Ambiguous Latin text now uses `und-Latn` instead of defaulting to `en`.
- Use `--mode chunk`/`--mode segments` or `--format json` to see the exact locale assigned to each chunk.
- Regex/script-only detection cannot reliably identify English vs. other Latin-script languages; 100% certainty requires explicit metadata (document language tags, user-provided locale, headers) or a language-ID model.

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

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
