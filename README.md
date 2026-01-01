# Word Counter

Locale-aware word counting powered by the Web API [`Intl.Segmenter`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter). The script automatically detects the primary writing system for each portion of the input, segments the text with the matching locale, and reports word totals per language.

## How It Works

- The runtime inspects each character's Unicode script to infer its likely locale (e.g., `en-US`, `zh-Hans`, `ja-JP`).
- Adjacent characters that share the same locale are grouped into a chunk.
- Each chunk is counted with `Intl.Segmenter` at `granularity: "word"`, caching segmenters to avoid re-instantiation.
- Per-locale counts are summed into a overall total and printed to stdout.

## Usage

Build the CLI, then run it with Node:

```bash
npm run build
node dist/esm/bin.mjs "Hello 世界 안녕"
```

You can also pipe text:

```bash
echo "こんにちは world مرحبا" | node dist/esm/bin.mjs
```

Or read from a file:

```bash
node dist/esm/bin.mjs --path ./fixtures/sample.txt
```

## Library Usage

ESM:

```js
import wordCounter, { countWordsForLocale, segmentTextByLocale } from "word-counter";
```

CJS:

```js
const wordCounter = require("word-counter");
const { countWordsForLocale, segmentTextByLocale, showSingularOrPluralWord } =
  wordCounter;
```

### Display Modes

Choose a breakdown style with `--mode` (or `-m`):

- `chunk` (default) – list each contiguous locale block in order of appearance.
- `segments` – show the actual wordlike segments used for counting.
- `collector` – aggregate counts per locale regardless of text position.

Examples:

```bash
# chunk mode (default)
node dist/esm/bin.mjs "飛鳥 bird 貓 cat; how do you do?"

# show captured segments
node dist/esm/bin.mjs --mode segments "飛鳥 bird 貓 cat; how do you do?"

# aggregate per locale
node dist/esm/bin.mjs -m collector "飛鳥 bird 貓 cat; how do you do?"
```

### Output Formats

Select how results are printed with `--format`:

- `standard` (default) – total plus per-locale breakdown.
- `raw` – only the total count (single number).
- `json` – machine-readable output; add `--pretty` for indentation.

Examples:

```bash
node dist/esm/bin.mjs --format raw "Hello world"
node dist/esm/bin.mjs --format json --pretty "Hello world"
```

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
