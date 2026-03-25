# Word Counter

Locale-aware word counting powered by the Web API [`Intl.Segmenter`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter). The script automatically detects the primary writing system for each portion of the input, segments the text with matching BCP 47 locale tags, and reports word totals per locale.

## Quick Start (npx)

Runtime requirement: Node.js `>=20`.

Run without installing:

```bash
npx @dev-pi2pie/word-counter "Hello 世界 안녕"
```

Pipe stdin:

```bash
echo "こんにちは world مرحبا" | npx @dev-pi2pie/word-counter
```

File input:

```bash
npx @dev-pi2pie/word-counter --path ./examples/yaml-basic.md
```

## Install and Usage Paths

Pick one path based on how often you use it:

1. One-off use: `npx @dev-pi2pie/word-counter ...` (no install, best for quick checks and CI snippets).
2. Frequent CLI use: `npm install -g @dev-pi2pie/word-counter@latest` then run `word-counter ...`.
3. Library use in code: `npm install @dev-pi2pie/word-counter` and import from your app/scripts.

For local development in this repository:

```bash
git clone https://github.com/dev-pi2pie/word-counter.git
cd word-counter
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
bun install
bun run build
npm link
```

Then:

```bash
word-counter "Hello 世界 안녕"
```

To remove the global link:

```bash
npm unlink --global @dev-pi2pie/word-counter
```

## CLI Usage

Basic text:

```bash
word-counter "Hello 世界 안녕"
```

Hint a language tag for ambiguous Latin text:

```bash
word-counter --latin-language en "Hello world"
word-counter --latin-tag en "Hello world"
```

Add custom Latin hint rules (repeatable) or load from JSON:

```bash
word-counter --latin-hint 'pl=[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' "Zażółć gęślą jaźń"
word-counter --latin-hint 'tr=[çğıöşüÇĞİÖŞÜ]' --latin-hint 'ro=[ăâîșțĂÂÎȘȚ]' "șță"
word-counter --latin-hints-file ./examples/latin-hints.json "Zażółć Știință Iğdır"
word-counter --no-default-latin-hints --latin-hint 'pl=[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' "Zażółć"
```

`examples/latin-hints.json` format:

```json
[
  { "tag": "pl", "pattern": "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" },
  { "tag": "tr", "pattern": "[çğıöşüÇĞİÖŞÜ]", "priority": 1 }
]
```

Hint a language tag for Han fallback:

```bash
word-counter --han-language zh-Hant "漢字測試"
word-counter --han-tag zh-Hans "汉字测试"
```

Enable the optional WASM detector for ambiguous Latin and Han routes:

```bash
word-counter --detector wasm "This sentence should clearly be detected as English for the wasm detector path."
word-counter --detector wasm "漢字測試需要更多內容才能觸發偵測"
```

Inspect detector behavior without count output:

```bash
word-counter inspect "こんにちは、世界！これはテストです。"
word-counter inspect --view engine "This sentence should clearly be detected as English for the wasm detector path."
word-counter inspect --detector regex -f json "こんにちは、世界！これはテストです。"
word-counter inspect -p ./examples/yaml-basic.md
```

Detector mode notes:

- `--detector regex` is the default behavior.
- `--detector wasm` only runs for ambiguous `und-Latn` and `und-Hani` chunks.
- `--detector regex` keeps the original script/regex chunk-first detection path.
- `--detector wasm` uses a detector-oriented ambiguous-window scoring pass before accepted tags are projected back onto the counting chunks.
- In `--detector wasm` mode, Latin hint rules and explicit Latin hint flags are deferred until after detector evaluation and only relabel unresolved `und-Latn` output.
- Very short chunks stay on the original `und-*` fallback.
- Low-confidence or unsupported detector results fall back to `und-*`.
- Technical-noise-heavy Latin windows stay conservative and may remain `und-Latn` even when the detector produces a wrong-but-confident language guess.
- `word-counter inspect` is single-input only in the first version:
  - positional text input
  - one `-p, --path <file>`
  - no batch or directory inspect mode yet

### Detector Subpath (`@dev-pi2pie/word-counter/detector`)

Use the detector subpath when you need async detector-aware APIs directly in library code.

```ts
import {
  inspectTextWithDetector,
  segmentTextByLocaleWithDetector,
  wordCounterWithDetector,
} from "@dev-pi2pie/word-counter/detector";

const inspectResult = await inspectTextWithDetector("こんにちは、世界！これはテストです。", {
  detector: "wasm",
  view: "pipeline",
});
```

Detector subpath notes:

- detector entrypoints are async
- use the root package for normal counting when you do not need detector-specific control
- use `detectorDebug` for counting-flow runtime diagnostics
- use `inspectTextWithDetector()` for direct detector diagnosis as structured data

Collect non-words (emoji/symbols/punctuation):

```bash
word-counter --non-words "Hi 👋, world!"
```

Override total composition:

```bash
word-counter --non-words --total-of words "Hi 👋, world!"
word-counter --total-of punctuation --format raw "Hi, world!"
word-counter --total-of words,emoji --format json "Hi 👋, world!"
```

## Batch Counting (`--path`)

Repeat `--path` for mixed inputs (files and/or directories):

```bash
word-counter --path ./docs/a.md --path ./docs --path ./notes.txt
```

Directory scans are recursive by default:

```bash
word-counter --path ./examples/test-case-multi-files-support
word-counter --path ./examples/test-case-multi-files-support --no-recursive
```

Show per-file plus merged summary:

```bash
word-counter --path ./examples/test-case-multi-files-support --per-file
```

Progress behavior in standard batch mode:

```bash
word-counter --path ./examples/test-case-multi-files-support
word-counter --path ./examples/test-case-multi-files-support --no-progress
word-counter --path ./examples/test-case-multi-files-support --keep-progress
```

Progress is transient by default, auto-disabled for single-input runs, and suppressed in `--format raw` and `--format json`.

### Batch Concurrency (`--jobs`)

Use `--jobs` to control batch concurrency:

```bash
word-counter --path ./examples/test-case-multi-files-support --jobs 1
word-counter --path ./examples/test-case-multi-files-support --jobs 4
```

Quick policy:

- no `--jobs` and `--jobs 1` are equivalent baseline behavior.
- `--jobs 1`: async main-thread `load+count` baseline.
- `--jobs > 1`: worker `load+count` with async fallback when workers are unavailable.
- if requested `--jobs` exceeds host `suggestedMaxJobs` (from `--print-jobs-limit`), the CLI warns and runs with the suggested limit as a safety cap.
- use `--quiet-warnings` to suppress non-fatal warning lines (for example jobs-limit advisory and worker-fallback warning).

Inspect host jobs diagnostics:

```bash
word-counter --print-jobs-limit
```

`--print-jobs-limit` must be used alone (no other inputs or runtime flags).

### Doctor (`doctor`)

Use `doctor` to verify whether the current host can run `word-counter` reliably:

```bash
word-counter doctor
word-counter doctor --format json
word-counter doctor --format json --pretty
```

Doctor scope in v1:

- checks runtime support policy against Node.js `>=20`
- verifies `Intl.Segmenter` availability plus word/grapheme constructor health
- reports batch jobs host limits using the same heuristics as `--print-jobs-limit`
- reports worker-route preflight signals and the worker-disable env toggle that affects worker availability

Doctor output contract:

- default output is human-readable text
- `--format json` prints compact machine-readable JSON
- `--format json --pretty` prints indented JSON
- doctor exits with code `0` for `ok` / `warn`, `1` for invalid doctor usage, and `2` for runtime `fail`
- doctor does not accept counting inputs, `--path`, `--jobs`, or other counting/debug flags

For a field-by-field explanation of doctor text and JSON output, see [`docs/doctor-usage-guide.md`](docs/doctor-usage-guide.md).

For full policy details, JSON parity expectations (`--misc`, `--total-of whitespace,words`), and benchmark standards, see [`docs/batch-jobs-usage-guide.md`](docs/batch-jobs-usage-guide.md).

### Stable Path Resolution Contract

- Repeated `--path` values are accepted as mixed inputs (file + directory).
- In `--path-mode auto` (default), directory inputs are expanded to files (recursive unless `--no-recursive`).
- In `--path-mode manual`, `--path` values are treated as literal file inputs; `--path <dir>` is not supported and is skipped as `not a regular file`.
- Extension and regex filters apply only to files discovered from directory expansion.
- Direct file inputs are always considered regardless of `--include-ext` / `--exclude-ext` / `--regex`.
- Overlap dedupe is by resolved absolute file path.
- If the same file is discovered multiple ways (repeated roots, nested roots, explicit file + directory), it is counted once.
- Final processing order is deterministic: resolved files are sorted by absolute path ascending before load/count.

Path mode examples:

```bash
word-counter --path ./examples/test-case-multi-files-support --path-mode auto
word-counter --path ./examples/test-case-multi-files-support --path-mode manual
word-counter --path ./examples/test-case-multi-files-support/a.md --path-mode manual
```

### Extension Filters

Use include/exclude filters for directory scans:

```bash
word-counter --path ./examples/test-case-multi-files-support --include-ext .md,.mdx
word-counter --path ./examples/test-case-multi-files-support --include-ext .md,.txt --exclude-ext .txt
```

Direct file path example (filters do not block explicit file inputs):

```bash
word-counter --path ./examples/test-case-multi-files-support/ignored.js --include-ext .md --exclude-ext .md
```

### Regex Filter (`--regex`)

Use `--regex` to include only directory-scanned files whose root-relative path matches:

```bash
word-counter --path ./examples/test-case-multi-files-support --regex '^a\\.md$'
word-counter --path ./examples/test-case-multi-files-support --regex '^nested/.*\\.md$'
word-counter --path ./examples/test-case-multi-files-support --path ./examples --regex '\\.md$'
```

Regex behavior contract:

- `--regex` applies only to files discovered from `--path <dir>` expansion.
- Matching is against each directory root-relative path.
- The same regex is applied across all provided directory roots.
- Direct file inputs are literal and are not blocked by regex filters.
- In `--path-mode manual`, directories are not expanded, so `--include-ext`, `--exclude-ext`, and `--regex` have no effect.
- `--regex` is single-use; repeated `--regex` flags fail fast with a misuse error.
- Empty regex values are treated as no regex restriction.

For additional usage details and troubleshooting, see [`docs/regex-usage-guide.md`](docs/regex-usage-guide.md).

### Debugging Diagnostics (`--debug`)

Noise policy: default output shows errors + warnings; `--debug` enables diagnostics; `--verbose` enables per-item diagnostics; `--quiet-warnings` suppresses warnings.

`--debug` remains the diagnostics gate and now defaults to `compact` event volume:

- lifecycle/stage timing events
- resolved/skipped summary events
- dedupe/filter summary counts

Use `--verbose` to include per-file/per-path events:

```bash
word-counter --path ./examples/test-case-multi-files-support --debug --verbose
```

Use `--debug-report [path]` to route debug diagnostics to a JSONL report file:

- no path: writes to current working directory with pattern `wc-debug-YYYYMMDD-HHmmss-utc-<pid>.jsonl`
- no path with `--detector-evidence`: writes with pattern `wc-detector-evidence-YYYYMMDD-HHmmss-utc-<pid>.jsonl`
- path provided: writes to the specified location
- default-name collision handling: appends `-<n>` suffix to avoid overwriting existing files
- explicit path validation: existing directories are rejected (explicit paths are treated as file targets)
- compatibility note: the autogenerated filename moved from the older local-time pattern to the new UTC `...-utc-...jsonl` pattern

By default with `--debug-report`, debug lines are file-only (not mirrored to terminal).
Use `--debug-report-tee` (alias: `--debug-tee`) to mirror to both file and `stderr`.
Flag dependencies: `--verbose` requires `--debug`; `--detector-evidence` requires `--debug` and `--detector wasm`; `--debug-report` requires `--debug`; `--debug-report-tee`/`--debug-tee` requires `--debug-report`.

Use `--detector-evidence` to add per-window detector evidence onto the same debug stream:

- only meaningful with `--detector wasm`
- compact mode emits bounded single-line previews plus detector decision metadata
- verbose mode emits full raw detector windows and full normalized samples
- evidence remains detector-window based even when output mode changes to `collector`, `char`, or another counting mode
- fallback evidence reports the post-fallback final tag used by downstream counting output; in rare split-relabel cases it may also include `finalLocales`

Examples:

```bash
word-counter --path ./examples/test-case-multi-files-support --debug --debug-report
word-counter --path ./examples/test-case-multi-files-support --debug --debug-report ./logs/debug.jsonl
word-counter --path ./examples/test-case-multi-files-support --debug --debug-report ./logs/debug.jsonl --debug-report-tee
word-counter --path ./examples/test-case-multi-files-support --debug --debug-report ./logs/debug.jsonl --debug-tee
word-counter --detector wasm --debug --detector-evidence "This sentence should clearly be detected as English for the wasm detector path."
word-counter --detector wasm --debug --verbose --detector-evidence "This sentence should clearly be detected as English for the wasm detector path."
word-counter --detector wasm --debug --detector-evidence --debug-report
```

Skip details stay debug-gated and can be suppressed with `--quiet-skips`.

When `--format json` is combined with `--debug`, debug-only diagnostics are emitted under `debug.*`:

- single input and merged batch may include `debug.detector`
- per-file batch may include `debug.skipped`, `debug.detector`, and per-entry `files[i].debug.detector`
- per-file top-level `skipped` is still emitted temporarily for compatibility

## How It Works

- The runtime inspects each character's Unicode script to infer its likely locale tag (e.g., `und-Latn`, `und-Hani`, `ja`).
- Adjacent characters that share the same locale tag are grouped into a chunk.
- Each chunk is counted with `Intl.Segmenter` at `granularity: "word"`, caching segmenters to avoid re-instantiation.
- Per-locale counts are summed into an overall total and printed to stdout.
- With `--detector wasm`, ambiguous `und-Latn` and `und-Hani` chunks can be relabeled through the optional WASM detector before counting; unresolved `und-Latn` chunks then fall back to the existing Latin hint rules and explicit Latin hint precedence.

## Locale vs Language Code

- Output keeps the field name `locale` for compatibility.
- In this project, locale values are BCP 47 tags and are often language/script focused (for example: `en`, `und-Latn`, `und-Hani`) rather than region-specific tags (for example: `en-US`, `zh-TW`).
- Default detection prefers language/script tags to avoid incorrect region assumptions.
- You can still provide region-specific locale tags through hint flags when needed.

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
import {
  wordCounterWithDetector,
  segmentTextByLocaleWithDetector,
} from "@dev-pi2pie/word-counter/detector";

wordCounter("Hello world", { latinLanguageHint: "en" });
wordCounter("Hello world", { latinTagHint: "en" });
wordCounter("Zażółć gęślą jaźń", {
  latinHintRules: [{ tag: "pl", pattern: "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" }],
});
wordCounter("Über", { useDefaultLatinHints: false });
wordCounter("漢字測試", { hanTagHint: "zh-Hant" });
wordCounter("Hi 👋, world!", { nonWords: true });
wordCounter("Hi 👋, world!", { mode: "char", nonWords: true });
wordCounter("飛鳥 bird 貓 cat", { mode: "char-collector" });
wordCounter("Hi\tthere\n", { nonWords: true, includeWhitespace: true });
countCharsForLocale("👋", "en");
await wordCounterWithDetector(
  "This sentence should clearly be detected as English for the wasm detector path.",
  { detector: "wasm" },
);
await segmentTextByLocaleWithDetector("Hello 世界", { detector: "regex" });
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
const detector = require("@dev-pi2pie/word-counter/detector");
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
wordCounter("Zażółć gęślą jaźń", {
  latinHintRules: [{ tag: "pl", pattern: "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" }],
});
wordCounter("Über", { useDefaultLatinHints: false });
wordCounter("漢字測試", { hanTagHint: "zh-Hant" });
wordCounter("Hi 👋, world!", { nonWords: true });
wordCounter("Hi 👋, world!", { mode: "char", nonWords: true });
wordCounter("飛鳥 bird 貓 cat", { mode: "char-collector" });
wordCounter("Hi\tthere\n", { nonWords: true, includeWhitespace: true });
countCharsForLocale("👋", "en");
await detector.wordCounterWithDetector(
  "This sentence should clearly be detected as English for the wasm detector path.",
  { detector: "wasm" },
);
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

#### Detector Subpath

Import from `@dev-pi2pie/word-counter/detector` for the explicit detector-enabled API.

| Export                        | Kind     | Notes                                           |
| ----------------------------- | -------- | ----------------------------------------------- |
| `wordCounterWithDetector`     | function | Async detector-aware counting entrypoint.       |
| `segmentTextByLocaleWithDetector` | function | Async detector-aware locale segmentation.  |
| `countSectionsWithDetector`   | function | Async detector-aware section counting.          |
| `DEFAULT_DETECTOR_MODE`       | value    | Current default detector mode (`regex`).        |
| `DETECTOR_MODES`              | value    | Supported detector modes.                       |

#### Types

| Export                 | Kind | Notes                                             |
| ---------------------- | ---- | ------------------------------------------------- |
| `WordCounterOptions`   | type | Options for the `wordCounter` function.           |
| `WordCounterResult`    | type | Returned by `wordCounter`.                        |
| `WordCounterBreakdown` | type | Breakdown payload in `WordCounterResult`.         |
| `WordCounterMode`      | type | `"chunk" \| "segments" \| "collector" \| "char" \| "char-collector"`. |
| `NonWordCollection`    | type | Non-word segments + counts payload.               |

### Display Modes

Choose a breakdown style with `--mode` (or `-m`):

- `chunk` (default) – list each contiguous locale block in order of appearance.
- `segments` – show the actual wordlike segments used for counting.
- `collector` – aggregate counts per locale regardless of text position.
  Keeps per-locale segment lists in memory, so very large corpora can use noticeably more memory than `chunk` mode.
- `char` – count grapheme clusters (user-perceived characters) per locale.
- `char-collector` – aggregate grapheme-cluster counts per locale (collector-style char mode).

Aliases are normalized for CLI + API:

- `chunk`, `chunks`
- `segments`, `segment`, `seg`
- `collector`, `collect`, `colle`
- `char`, `chars`, `character`, `characters`
- `char-collector`, `charcollector`, `char-collect`, `collector-char`, `characters-collector`, `colchar`, `charcol`, `char-col`, `char-colle`

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

# aggregate grapheme-aware character counts per locale
word-counter -m char-collector "飛鳥 bird 貓 cat; how do you do?"
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
    { "name": "content", "source": "frontmatter", "result": { "total": 4 } },
    { "name": "content", "source": "frontmatter", "result": { "total": 2 } },
    { "name": "content", "source": "content", "result": { "total": 5 } }
  ]
}
```

### Output Formats

Select how results are printed with `--format`:

- `standard` (default) – total plus per-locale breakdown.
- `raw` – only the total count (single number).
- `json` – machine-readable output; add `--pretty` for indentation.

JSON contract reference:
- `docs/schemas/json-output-contract.md`

Examples:

```bash
word-counter --format raw "Hello world"
word-counter --format json --pretty "Hello world"
```

### Selective Totals (`--total-of`)

Use `--total-of <parts>` to override how the displayed `total` is computed.

Supported parts:

- `words`
- `emoji`
- `symbols`
- `punctuation`
- `whitespace`

Examples:

```bash
word-counter --non-words --total-of words "Hi 👋, world!"
word-counter --total-of punctuation --format raw "Hi, world!"
word-counter --total-of words,emoji --format json "Hi 👋, world!"
```

Rules:

- Without `--total-of`, behavior stays unchanged.
- With `--total-of`, `--format raw` prints the override total only.
- In standard output, `Total-of (override: ...)` is shown only when override total differs from the base total.
- If selected parts require non-word data (for example `emoji` or `punctuation`), non-word collection is enabled internally as needed.
- `--total-of` does not implicitly enable non-word display mode: base `Total ...` labeling and non-word breakdown visibility still follow explicit flags (`--non-words`, `--include-whitespace`, `--misc`).
- Alias/normalization is tolerant for common variants:
  - `word` -> `words`
  - `symbol` -> `symbols`
  - `punction` -> `punctuation`

JSON output adds override metadata when `--total-of` is provided:

- single input and merged batch: `meta.totalOf`, `meta.totalOfOverride`
- per-file batch (`--per-file`):
  - top-level: `meta.totalOf`, `meta.aggregateTotalOfOverride`
  - per entry: `files[i].meta.totalOf`, `files[i].meta.totalOfOverride`
  - applies to both sectioned and non-sectioned per-file JSON results

Example JSON (trimmed):

```json
{
  "total": 5,
  "meta": {
    "totalOf": ["words", "emoji"],
    "totalOfOverride": 3
  }
}
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

In the CLI, `--include-whitespace` implies `--non-words` (same behavior as `--misc`). `--non-words` alone does not include whitespace. When enabled, whitespace counts appear under `nonWords.whitespace`, and `total = words + nonWords` (emoji + symbols + punctuation + whitespace). JSON output also includes top-level `counts` when `nonWords` is enabled. See `docs/schemas/whitespace-categories.md` for how whitespace is categorized.

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

## Locale Tag Detection Notes

- Detection is regex/script based, not statistical language-ID.
- Ambiguous Latin defaults to `und-Latn`; Han fallback defaults to `und-Hani`.
- `--detector wasm` is optional and conservative; it only runs for ambiguous chunks that meet minimum script-bearing length thresholds.
- In `--detector wasm` mode, ambiguous Latin stays on `und-Latn` for detector eligibility first, then built-in/custom Latin rules and explicit Latin hints are applied only if the detector leaves that chunk unresolved.
- The current first WASM engine is `whatlang`, remapped into this package's public tags.
- The npm package ships one portable WASM artifact; users do not install per-OS detector packages.
- Use explicit tag and hint flags when you need deterministic tagging.
- Full notes (built-in heuristics, limitations, and override guidance) are tracked in `docs/locale-tag-detection-notes.md`.

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
