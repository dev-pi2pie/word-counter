import { readFile } from "node:fs/promises";
import pc from "picocolors";
import { parseMarkdown, type SectionMode } from "../../markdown";
import { inspectTextWithDetector, type DetectorInspectResult } from "../../detector";
import { createInspectPreview } from "../../detector/inspect-helpers";
import type { DetectorInspectView } from "../../detector/inspect-types";
import { isProbablyBinary } from "../path/load";
import { buildDirectoryExtensionFilter } from "../path/filter";
import { resolveBatchFileEntries } from "../path/resolve";
import { formatInputReadError } from "../runtime/options";
import type { BatchResolvedFile, BatchSkip, PathMode } from "../types";

type InspectOutputFormat = "standard" | "json";
type InspectDetectorMode = "wasm" | "regex";
type InspectSectionMode = Extract<SectionMode, "all" | "frontmatter" | "content">;

type ExecuteInspectCommandOptions = {
  argv: string[];
};

type ValidInspectInvocation =
  | {
      ok: true;
      help?: false;
      detector: InspectDetectorMode;
      view: DetectorInspectView;
      format: InspectOutputFormat;
      pretty: boolean;
      section: InspectSectionMode;
      pathMode: PathMode;
      recursive: boolean;
      includeExt: string[];
      excludeExt: string[];
      regex?: string;
      paths: string[];
      textTokens: string[];
    }
  | {
      ok: true;
      help: true;
    }
  | {
      ok: false;
      message: string;
    };

type InspectLoadedPathInput = {
  path: string;
  source: BatchResolvedFile["source"];
  text: string;
};

type InspectBatchJsonPayload = {
  schemaVersion: 1;
  kind: "detector-inspect-batch";
  detector: InspectDetectorMode;
  view: DetectorInspectView;
  section: InspectSectionMode;
  summary: {
    requestedInputs: number;
    succeeded: number;
    skipped: number;
    failed: number;
  };
  files: Array<{
    path: string;
    result: DetectorInspectResult;
  }>;
  skipped: BatchSkip[];
  failures: BatchSkip[];
};

const INSPECT_HELP_LINES = [
  "Usage: word-counter inspect [options] [text...]",
  "",
  "inspect detector behavior without count output",
  "",
  "Options:",
  "  --detector <mode>  inspect detector mode (wasm, regex) (default: wasm)",
  "  --view <view>      inspect view (pipeline, engine) (default: pipeline)",
  "  -f, --format <format>  inspect output format (standard, json) (default: standard)",
  "  --pretty          pretty print inspect JSON output",
  "  --section <section>  inspect section selector (all, frontmatter, content) (default: all)",
  "  --path-mode <mode>  path resolution mode for --path inputs (auto, manual) (default: auto)",
  "  --no-recursive     disable recursive directory traversal for --path directories",
  "  --include-ext <exts>  comma-separated extensions to include during directory scanning",
  "  --exclude-ext <exts>  comma-separated extensions to exclude during directory scanning",
  "  --regex <pattern>  regex filter for directory-expanded paths",
  "  -p, --path <path>  inspect text from file or directory inputs",
  "  -h, --help         display help for command",
];

function parseDetector(rawValue: string | undefined): InspectDetectorMode | null {
  if (rawValue === undefined) {
    return "wasm";
  }
  if (rawValue === "wasm" || rawValue === "regex") {
    return rawValue;
  }
  return null;
}

function parseView(rawValue: string | undefined): DetectorInspectView | null {
  if (rawValue === undefined) {
    return "pipeline";
  }
  if (rawValue === "pipeline" || rawValue === "engine") {
    return rawValue;
  }
  return null;
}

function parseFormat(rawValue: string | undefined): InspectOutputFormat | null {
  if (rawValue === undefined) {
    return "standard";
  }
  if (rawValue === "standard" || rawValue === "json") {
    return rawValue;
  }
  return null;
}

function parseSection(rawValue: string | undefined): InspectSectionMode | null {
  if (rawValue === undefined) {
    return "all";
  }
  if (rawValue === "all" || rawValue === "frontmatter" || rawValue === "content") {
    return rawValue;
  }
  return null;
}

function parsePathMode(rawValue: string | undefined): PathMode | null {
  if (rawValue === undefined) {
    return "auto";
  }
  if (rawValue === "auto" || rawValue === "manual") {
    return rawValue;
  }
  return null;
}

function isSupportedInspectSectionMode(value: string): value is InspectSectionMode {
  return value === "all" || value === "frontmatter" || value === "content";
}

function validateInspectInvocation(argv: string[]): ValidInspectInvocation {
  const inspectIndex = argv.findIndex((token, index) => index >= 2 && token === "inspect");
  const tokens = inspectIndex >= 0 ? argv.slice(inspectIndex + 1) : [];
  let detector: InspectDetectorMode = "wasm";
  let view: DetectorInspectView = "pipeline";
  let format: InspectOutputFormat = "standard";
  let pretty = false;
  let section: InspectSectionMode = "all";
  let pathMode: PathMode = "auto";
  let recursive = true;
  const paths: string[] = [];
  const includeExt: string[] = [];
  const excludeExt: string[] = [];
  let regex: string | undefined;
  const textTokens: string[] = [];
  let expects:
    | "detector"
    | "view"
    | "format"
    | "section"
    | "pathMode"
    | "path"
    | "includeExt"
    | "excludeExt"
    | "regex"
    | null = null;
  let positionalMode = false;

  const consumeValue = (
    kind:
      | "detector"
      | "view"
      | "format"
      | "section"
      | "pathMode"
      | "path"
      | "includeExt"
      | "excludeExt"
      | "regex",
    value: string,
  ): string | null => {
    if (kind === "detector") {
      const parsed = parseDetector(value);
      if (parsed === null) {
        return "`--detector` must be `wasm` or `regex`.";
      }
      detector = parsed;
      return null;
    }

    if (kind === "view") {
      const parsed = parseView(value);
      if (parsed === null) {
        return "`--view` must be `pipeline` or `engine`.";
      }
      view = parsed;
      return null;
    }

    if (kind === "format") {
      if (value === "raw") {
        return "`inspect` does not support `--format raw`.";
      }
      const parsed = parseFormat(value);
      if (parsed === null) {
        return "`--format` must be `standard` or `json`.";
      }
      format = parsed;
      return null;
    }

    if (kind === "section") {
      if (!isSupportedInspectSectionMode(value)) {
        return "`inspect` supports `--section all`, `frontmatter`, or `content`.";
      }
      section = value;
      return null;
    }

    if (kind === "pathMode") {
      const parsed = parsePathMode(value);
      if (parsed === null) {
        return "`--path-mode` must be `auto` or `manual`.";
      }
      pathMode = parsed;
      return null;
    }

    if (kind === "path") {
      paths.push(value);
      return null;
    }

    if (kind === "includeExt") {
      includeExt.push(value);
      return null;
    }

    if (kind === "excludeExt") {
      excludeExt.push(value);
      return null;
    }

    if (regex !== undefined) {
      return "`--regex` can only be provided once.";
    }
    regex = value;
    return null;
  };

  for (const token of tokens) {
    if (token === "-h" || token === "--help") {
      return { ok: true, help: true };
    }

    if (expects) {
      const error = consumeValue(expects, token);
      if (error) {
        return { ok: false, message: error };
      }
      expects = null;
      continue;
    }

    if (positionalMode) {
      textTokens.push(token);
      continue;
    }

    if (token === "--") {
      positionalMode = true;
      continue;
    }

    if (token === "--no-recursive") {
      recursive = false;
      continue;
    }

    if (token === "--pretty") {
      pretty = true;
      continue;
    }

    if (
      token === "--detector" ||
      token === "--view" ||
      token === "--format" ||
      token === "-f" ||
      token === "--section" ||
      token === "--path-mode" ||
      token === "--path" ||
      token === "-p" ||
      token === "--include-ext" ||
      token === "--exclude-ext" ||
      token === "--regex"
    ) {
      expects =
        token === "-p"
          ? "path"
          : token === "-f"
            ? "format"
            : token === "--path-mode"
              ? "pathMode"
              : token === "--include-ext"
                ? "includeExt"
                : token === "--exclude-ext"
                  ? "excludeExt"
                  : (token.slice(2) as
                      | "detector"
                      | "view"
                      | "format"
                      | "section"
                      | "path"
                      | "regex");
      continue;
    }

    if (
      token.startsWith("--detector=") ||
      token.startsWith("--view=") ||
      token.startsWith("--format=") ||
      token.startsWith("--section=") ||
      token.startsWith("--path-mode=") ||
      token.startsWith("--path=") ||
      token.startsWith("--include-ext=") ||
      token.startsWith("--exclude-ext=") ||
      token.startsWith("--regex=")
    ) {
      const separatorIndex = token.indexOf("=");
      const optionName = token.slice(2, separatorIndex);
      const value = token.slice(separatorIndex + 1);
      if (value.length === 0) {
        return {
          ok: false,
          message: `\`--${optionName}\` requires a value.`,
        };
      }

      const normalizedOption =
        optionName === "path-mode"
          ? "pathMode"
          : optionName === "include-ext"
            ? "includeExt"
            : optionName === "exclude-ext"
              ? "excludeExt"
              : (optionName as
                  | "detector"
                  | "view"
                  | "format"
                  | "section"
                  | "path"
                  | "regex");

      const error = consumeValue(normalizedOption, value);
      if (error) {
        return { ok: false, message: error };
      }
      continue;
    }

    if (token.startsWith("-")) {
      return {
        ok: false,
        message: `\`${token}\` is not supported by \`inspect\`.`,
      };
    }

    textTokens.push(token);
  }

  if (expects) {
    const optionName =
      expects === "pathMode"
        ? "path-mode"
        : expects === "includeExt"
          ? "include-ext"
          : expects === "excludeExt"
            ? "exclude-ext"
            : expects;
    return {
      ok: false,
      message: `\`--${optionName}\` requires a value.`,
    };
  }

  if (paths.length > 0 && textTokens.length > 0) {
    return {
      ok: false,
      message: "`inspect` accepts either positional text or --path inputs, not both.",
    };
  }

  if (paths.length === 0 && textTokens.length === 0) {
    return {
      ok: false,
      message: "No inspect input provided. Pass text or use --path.",
    };
  }

  if (
    (view as DetectorInspectView) === "engine" &&
    (detector as InspectDetectorMode) === "regex"
  ) {
    return {
      ok: false,
      message: "`--view engine` requires `--detector wasm`.",
    };
  }

  return {
    ok: true,
    detector,
    view,
    format,
    pretty,
    section,
    pathMode,
    recursive,
    includeExt,
    excludeExt,
    ...(regex !== undefined ? { regex } : {}),
    paths,
    textTokens,
  };
}

export function isExplicitInspectInvocation(argv: string[]): boolean {
  return argv[2] === "inspect";
}

function printInspectHelp(): void {
  for (const line of INSPECT_HELP_LINES) {
    console.log(line);
  }
}

function selectInspectText(input: string, section: InspectSectionMode): string {
  if (section === "all") {
    return input;
  }

  const parsed = parseMarkdown(input);
  if (section === "frontmatter") {
    return parsed.frontmatter ?? "";
  }

  return parsed.content;
}

async function loadSingleInspectInput(path: string | undefined, textTokens: string[], section: InspectSectionMode): Promise<{
  text: string;
  sourceType: "inline" | "path";
  path?: string;
}> {
  if (path) {
    try {
      const buffer = await readFile(path);
      if (isProbablyBinary(buffer)) {
        throw new Error("binary file");
      }
      return {
        text: selectInspectText(buffer.toString("utf8"), section),
        sourceType: "path",
        path,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "binary file") {
        throw error;
      }
      throw new Error(formatInputReadError(error));
    }
  }

  return {
    text: selectInspectText(textTokens.join(" "), section),
    sourceType: "inline",
  };
}

async function loadInspectBatchInputs(
  pathInputs: string[],
  options: {
    pathMode: PathMode;
    recursive: boolean;
    includeExt: string[];
    excludeExt: string[];
    regex?: string;
  },
): Promise<{
  files: InspectLoadedPathInput[];
  skipped: BatchSkip[];
  failures: BatchSkip[];
}> {
  const resolved = await resolveBatchFileEntries(pathInputs, {
    pathMode: options.pathMode,
    recursive: options.recursive,
    extensionFilter: buildDirectoryExtensionFilter(options.includeExt, options.excludeExt),
    ...(options.regex !== undefined ? { directoryRegexPattern: options.regex } : {}),
  });

  const skipped: BatchSkip[] = [];
  const failures: BatchSkip[] = [];
  for (const skip of resolved.skipped) {
    if (skip.source === "direct") {
      failures.push({ path: skip.path, reason: skip.reason });
      continue;
    }
    skipped.push({ path: skip.path, reason: skip.reason });
  }

  const files: InspectLoadedPathInput[] = [];
  for (const entry of resolved.files) {
    let buffer: Buffer;
    try {
      buffer = await readFile(entry.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ path: entry.path, reason: `not readable: ${message}` });
      continue;
    }

    if (isProbablyBinary(buffer)) {
      if (entry.source === "direct") {
        failures.push({ path: entry.path, reason: "binary file" });
      } else {
        skipped.push({ path: entry.path, reason: "binary file" });
      }
      continue;
    }

    files.push({
      path: entry.path,
      source: entry.source,
      text: buffer.toString("utf8"),
    });
  }

  skipped.sort((left, right) => left.path.localeCompare(right.path));
  failures.sort((left, right) => left.path.localeCompare(right.path));

  return { files, skipped, failures };
}

function buildInspectStandardLines(
  result: DetectorInspectResult,
  options: { includeTitle?: boolean } = {},
): string[] {
  const includeTitle = options.includeTitle !== false;
  const lines: string[] = [];

  if (includeTitle) {
    lines.push("Detector inspect");
    lines.push(`View: ${result.view}`);
    lines.push(`Detector: ${result.detector}`);
    lines.push("");
  }

  lines.push("Input");
  lines.push(`Source: ${result.input.sourceType}`);
  if (result.input.path) {
    lines.push(`Path: ${result.input.path}`);
  }
  lines.push(`Text length: ${result.input.textLength}`);

  if (result.view === "engine") {
    const samplePreview = createInspectPreview(result.sample.text);
    const normalizedPreview = createInspectPreview(result.sample.normalizedText);

    lines.push("");
    lines.push("Sample");
    lines.push(`Text source: ${result.sample.textSource}`);
    lines.push(`Sample text preview: ${JSON.stringify(samplePreview.textPreview)}`);
    lines.push(`Sample text truncated: ${samplePreview.textPreviewTruncated}`);
    lines.push(`Normalized text preview: ${JSON.stringify(normalizedPreview.textPreview)}`);
    lines.push(`Normalized text truncated: ${normalizedPreview.textPreviewTruncated}`);
    if (result.sample.borrowedContext) {
      lines.push(`Borrowed context: ${JSON.stringify(result.sample.borrowedContext)}`);
    }
    if (result.routeTag) {
      lines.push(`Route tag: ${result.routeTag}`);
    }
    if (result.engine) {
      lines.push("");
      lines.push("Engine");
      lines.push(
        `Raw: ${result.engine.raw.lang}/${result.engine.raw.script} confidence=${result.engine.raw.confidence} reliable=${result.engine.raw.reliable}`,
      );
      if (result.engine.normalized) {
        lines.push(
          `Normalized: ${result.engine.normalized.lang}/${result.engine.normalized.script} confidence=${result.engine.normalized.confidence} reliable=${result.engine.normalized.reliable}`,
        );
      }
      lines.push(
        `Remap: raw=${result.engine.remapped.rawTag ?? "null"} normalized=${result.engine.remapped.normalizedTag ?? "null"}`,
      );
    } else if (result.decision?.kind === "empty") {
      lines.push("");
      lines.push(`Decision: ${result.decision.notes.join(" ")}`);
    }
    return lines;
  }

  lines.push("");
  lines.push("Chunks");
  if (result.chunks.length === 0) {
    lines.push("(none)");
  } else {
    for (const chunk of result.chunks) {
      const source = chunk.source ? ` | ${chunk.source}` : "";
      const reason = chunk.reason ? ` | ${chunk.reason}` : "";
      lines.push(`[${chunk.index}] ${chunk.locale}${source}${reason} | ${JSON.stringify(chunk.textPreview)}`);
    }
  }

  if (result.windows) {
    for (const window of result.windows) {
      lines.push("");
      lines.push(`Window ${window.windowIndex}`);
      lines.push(`Route: ${window.routeTag}`);
      lines.push(`Chunk range: ${window.chunkRange.start}-${window.chunkRange.end}`);
      lines.push(`Focus: ${JSON.stringify(window.focusTextPreview)}`);
      if (window.diagnosticSample.borrowedContext) {
        lines.push(`Borrowed context: ${JSON.stringify(window.diagnosticSample.borrowedContext)}`);
      }
      lines.push(`Sample: ${JSON.stringify(window.diagnosticSample.textPreview)}`);
      lines.push(`Normalized sample: ${JSON.stringify(window.diagnosticSample.normalizedTextPreview)}`);
      lines.push(
        `Eligibility: ${window.eligibility.scriptChars}/${window.eligibility.minScriptChars} passed=${window.eligibility.passed}`,
      );
      lines.push(
        `Content gate: ${window.contentGate.policy} applied=${window.contentGate.applied} passed=${window.contentGate.passed}`,
      );
      lines.push(
        `Engine: ${window.engine.executed ? "executed" : `skipped (${window.engine.reason ?? "unknown"})`}`,
      );
      lines.push(
        `Decision: accepted=${window.decision.accepted} path=${window.decision.path ?? "null"} final=${window.decision.finalTag} fallback=${window.decision.fallbackReason ?? "null"}`,
      );
    }
  }

  if (result.decision && "kind" in result.decision) {
    lines.push("");
    lines.push(`Decision: ${result.decision.kind}`);
    lines.push(result.decision.notes.join(" "));
  }

  lines.push("");
  lines.push("Resolved");
  if (result.resolvedChunks.length === 0) {
    lines.push("(none)");
    return lines;
  }
  for (const chunk of result.resolvedChunks) {
    lines.push(`[${chunk.index}] ${chunk.locale} | ${JSON.stringify(chunk.textPreview)}`);
  }

  return lines;
}

function printLines(lines: string[]): void {
  for (const line of lines) {
    console.log(line);
  }
}

async function runSingleInspect(
  validated: Exclude<ValidInspectInvocation, { ok: false } | { ok: true; help: true }>,
  input: { text: string; sourceType: "inline" | "path"; path?: string },
): Promise<void> {
  const result = await inspectTextWithDetector(input.text, {
    detector: validated.detector,
    view: validated.view,
    input: {
      sourceType: input.sourceType,
      ...(input.path ? { path: input.path } : {}),
    },
  });

  if (validated.format === "json") {
    console.log(JSON.stringify(result, null, validated.pretty ? 2 : 0));
    process.exitCode = 0;
    return;
  }

  printLines(buildInspectStandardLines(result));
  process.exitCode = 0;
}

function buildInspectBatchJsonPayload(
  validated: Exclude<ValidInspectInvocation, { ok: false } | { ok: true; help: true }>,
  files: Array<{ path: string; result: DetectorInspectResult }>,
  skipped: BatchSkip[],
  failures: BatchSkip[],
): InspectBatchJsonPayload {
  return {
    schemaVersion: 1,
    kind: "detector-inspect-batch",
    detector: validated.detector,
    view: validated.view,
    section: validated.section,
    summary: {
      requestedInputs: validated.paths.length,
      succeeded: files.length,
      skipped: skipped.length,
      failed: failures.length,
    },
    files,
    skipped,
    failures,
  };
}

function buildInspectBatchStandardLines(payload: InspectBatchJsonPayload): string[] {
  const lines: string[] = [
    "Detector inspect batch",
    `View: ${payload.view}`,
    `Detector: ${payload.detector}`,
    `Section: ${payload.section}`,
    `Requested inputs: ${payload.summary.requestedInputs}`,
    `Summary: ${payload.summary.succeeded} succeeded, ${payload.summary.skipped} skipped, ${payload.summary.failed} failed`,
  ];

  for (const file of payload.files) {
    lines.push("");
    lines.push(`File: ${file.path}`);
    lines.push(...buildInspectStandardLines(file.result, { includeTitle: false }));
  }

  if (payload.skipped.length > 0) {
    lines.push("");
    lines.push("Skipped");
    for (const item of payload.skipped) {
      lines.push(`${item.path} | ${item.reason}`);
    }
  }

  if (payload.failures.length > 0) {
    lines.push("");
    lines.push("Failures");
    for (const item of payload.failures) {
      lines.push(`${item.path} | ${item.reason}`);
    }
  }

  return lines;
}

async function runInspectBatch(
  validated: Exclude<ValidInspectInvocation, { ok: false } | { ok: true; help: true }>,
  loaded: {
    files: InspectLoadedPathInput[];
    skipped: BatchSkip[];
    failures: BatchSkip[];
  },
): Promise<void> {
  const batchFiles: Array<{ path: string; result: DetectorInspectResult }> = [];
  for (const file of loaded.files) {
    const result = await inspectTextWithDetector(selectInspectText(file.text, validated.section), {
      detector: validated.detector,
      view: validated.view,
      input: {
        sourceType: "path",
        path: file.path,
      },
    });
    batchFiles.push({
      path: file.path,
      result,
    });
  }

  const payload = buildInspectBatchJsonPayload(validated, batchFiles, loaded.skipped, loaded.failures);
  if (validated.format === "json") {
    console.log(JSON.stringify(payload, null, validated.pretty ? 2 : 0));
  } else {
    printLines(buildInspectBatchStandardLines(payload));
  }

  process.exitCode = payload.failures.length > 0 || payload.files.length === 0 ? 1 : 0;
}

export async function executeInspectCommand({
  argv,
}: ExecuteInspectCommandOptions): Promise<void> {
  const validated = validateInspectInvocation(argv);
  if (!validated.ok) {
    console.error(pc.red(`error: ${validated.message}`));
    process.exitCode = 1;
    return;
  }

  if (validated.help) {
    printInspectHelp();
    process.exitCode = 0;
    return;
  }

  try {
    if (validated.paths.length === 0) {
      const input = await loadSingleInspectInput(undefined, validated.textTokens, validated.section);
      await runSingleInspect(validated, input);
      return;
    }

    const loaded = await loadInspectBatchInputs(validated.paths, {
      pathMode: validated.pathMode,
      recursive: validated.recursive,
      includeExt: validated.includeExt,
      excludeExt: validated.excludeExt,
      ...(validated.regex !== undefined ? { regex: validated.regex } : {}),
    });

    const directSinglePath =
      validated.paths.length === 1 &&
      loaded.files.length === 1 &&
      loaded.skipped.length === 0 &&
      loaded.failures.length === 0 &&
      loaded.files[0]?.source === "direct";

    if (directSinglePath) {
      const file = loaded.files[0];
      if (!file) {
        throw new Error("Missing inspect file input.");
      }
      await runSingleInspect(validated, {
        text: selectInspectText(file.text, validated.section),
        sourceType: "path",
        path: file.path,
      });
      return;
    }

    await runInspectBatch(validated, loaded);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`error: ${message}`));
    process.exitCode = 1;
  }
}
