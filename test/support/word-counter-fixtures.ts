export const WASM_LATIN_QUALITY_FIXTURES = [
  {
    id: "latin-prose-en-paragraph",
    text: "This sentence should clearly be detected as English for the wasm detector path.",
    expectedLocale: "en",
  },
  {
    id: "latin-prose-fr-paragraph",
    text: "Ceci est une phrase francaise suffisamment longue pour que le detecteur identifie correctement la langue.",
    expectedLocale: "fr",
  },
  {
    id: "latin-prose-en-short-reliable-line",
    text: "The repository documentation explains expected behavior.",
    expectedLocale: "en",
  },
  {
    id: "latin-prose-fr-short-reliable-line",
    text: "Cette documentation explique clairement le comportement attendu.",
    expectedLocale: "fr",
  },
  {
    id: "latin-prose-en-multiline-without-punctuation",
    text: [
      "Internationalization requires thoughtful language detection",
      "Repository documentation explains expected behavior",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-prose-en-hard-wrapped-short-lines",
    text: [
      "This guide explains",
      "expected behavior clearly",
      "for detector quality",
      "checks in docs",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-tech-cli-help",
    text: [
      "Usage: word-counter --path docs --format json --debug",
      "",
      "Options:",
      "  --debug enable structured diagnostics",
      "  --debug-report [path] write diagnostics to a report file",
      "  --debug-tee mirror diagnostics to stderr",
    ].join("\n"),
    expectedLocale: "und-Latn",
  },
  {
    id: "latin-tech-readme-commands",
    text: [
      "`bun install`",
      "`bun test`",
      "`word-counter --path docs --format json`",
      "`word-counter --debug-report report.jsonl --debug-tee`",
    ].join("\n"),
    expectedLocale: "und-Latn",
  },
  {
    id: "latin-mixed-frontmatter-short-prose",
    text: [
      "---",
      "title: Alpha Story",
      "summary: Intro note",
      "---",
      "Hello world from alpha. This guide explains the feature clearly for readers.",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-mixed-prose-then-command-block",
    text: [
      "This guide explains how to count words in a repository without changing the default output behavior.",
      "```sh",
      "word-counter --path docs --format json",
      "```",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-mixed-bullets-with-sentences",
    text: [
      "- This option keeps normal JSON output stable for downstream consumers.",
      "- This command writes detailed diagnostics only when debug mode is enabled.",
    ].join("\n"),
    expectedLocale: "en",
  },
  {
    id: "latin-mixed-config-heavy-with-brief-explanation",
    text: [
      "mode: debug",
      "verbosity: compact",
      "report_path: diagnostics.jsonl",
      "tee: true",
      "Use this for local testing.",
    ].join("\n"),
    expectedLocale: "und-Latn",
  },
] as const;
