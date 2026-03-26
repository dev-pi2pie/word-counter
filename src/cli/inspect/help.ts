const INSPECT_HELP_LINES = [
  "Usage: word-counter inspect [options] [text...]",
  "",
  "inspect detector behavior without count output",
  "",
  "Options:",
  "  -d, --detector <mode>  inspect detector mode (wasm, regex) (default: regex)",
  "  --content-gate <mode>  content gate mode (default, strict, loose, off) (default: default)",
  "  --view <view>      inspect view (pipeline, engine) (default: pipeline)",
  "  -f, --format <format>  inspect output format (standard, json) (default: standard)",
  "  --pretty          pretty print inspect JSON output",
  "  --section <section>  inspect section selector (all, frontmatter, content) (default: all)",
  "  --path-mode <mode>  path resolution mode for --path inputs (auto, manual) (default: auto)",
  "  --recursive        enable recursive directory traversal for --path directories",
  "  --no-recursive     disable recursive directory traversal for --path directories",
  "  --include-ext <exts>  comma-separated extensions to include during directory scanning",
  "  --exclude-ext <exts>  comma-separated extensions to exclude during directory scanning",
  "  --regex <pattern>  regex filter for directory-expanded paths",
  "  -p, --path <path>  inspect text from file or directory inputs",
  "  -h, --help         display help for command",
];

export function printInspectHelp(): void {
  for (const line of INSPECT_HELP_LINES) {
    console.log(line);
  }
}
