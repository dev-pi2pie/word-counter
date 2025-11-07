# Word Counter

Locale-aware word counting powered by the Web API [`Intl.Segmenter`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter). The script automatically detects the primary writing system for each portion of the input, segments the text with the matching locale, and reports word totals per language.

## How It Works

- The runtime inspects each character's Unicode script to infer its likely locale (e.g., `en-US`, `zh-Hans`, `ja-JP`).
- Adjacent characters that share the same locale are grouped into a chunk.
- Each chunk is counted with `Intl.Segmenter` at `granularity: "word"`, caching segmenters to avoid re-instantiation.
- Per-locale counts are summed into a overall total and printed to stdout.

## Usage

Run the script with Bun (or the transpiled JavaScript with Node):

```bash
bun src/index.ts "Hello 世界 안녕"
```

You can also pipe text:

```bash
echo "こんにちは world مرحبا" | bun src/index.ts
```

### Display Modes

Choose a breakdown style with `--mode` (or `-m`):

- `chunk` (default) – list each contiguous locale block in order of appearance.
- `segments` – show the actual wordlike segments used for counting.
- `collector` – aggregate counts per locale regardless of text position.

Examples:

```bash
# chunk mode (default)
bun src/index.ts "飛鳥 bird 貓 cat; how do you do?"

# show captured segments
bun src/index.ts --mode segments "飛鳥 bird 貓 cat; how do you do?"

# aggregate per locale
bun src/index.ts -m collector "飛鳥 bird 貓 cat; how do you do?"
```

## Sample Inputs

Try the following mixed-locale phrases to see how detection behaves:

- `"Hello world 你好世界"`
- `"Bonjour le monde こんにちは 세계"`
- `"¡Hola! مرحبا Hello"`

Each run prints the total word count plus a per-locale breakdown, helping you understand how multilingual text is segmented.
