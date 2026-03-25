import { readFile, stat } from "node:fs/promises";
import pc from "picocolors";
import { inspectTextWithDetector, type DetectorInspectResult } from "../../detector";
import { createInspectPreview } from "../../detector/inspect-helpers";
import type { DetectorInspectView } from "../../detector/inspect-types";
import { formatInputReadError } from "../runtime/options";

type InspectOutputFormat = "standard" | "json";
type InspectDetectorMode = "wasm" | "regex";

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
      path?: string;
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

const INSPECT_HELP_LINES = [
  "Usage: word-counter inspect [options] [text...]",
  "",
  "inspect detector behavior without count output",
  "",
  "Options:",
  "  --detector <mode>  inspect detector mode (wasm, regex) (default: wasm)",
  "  --view <view>      inspect view (pipeline, engine) (default: pipeline)",
  "  --format <format>  inspect output format (standard, json) (default: standard)",
  "  --path <file>      inspect text from one regular file",
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

function validateInspectInvocation(argv: string[]): ValidInspectInvocation {
  const inspectIndex = argv.findIndex((token, index) => index >= 2 && token === "inspect");
  const tokens = inspectIndex >= 0 ? argv.slice(inspectIndex + 1) : [];
  let detector: InspectDetectorMode = "wasm";
  let view: DetectorInspectView = "pipeline";
  let format: InspectOutputFormat = "standard";
  let path: string | undefined;
  const textTokens: string[] = [];
  let expects: "detector" | "view" | "format" | "path" | null = null;
  let positionalMode = false;

  const consumeValue = (kind: "detector" | "view" | "format" | "path", value: string): string | null => {
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

    if (path !== undefined) {
      return "`inspect` accepts one `--path <file>`.";
    }
    path = value;
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

    if (token === "--detector" || token === "--view" || token === "--format" || token === "--path") {
      expects = token.slice(2) as "detector" | "view" | "format" | "path";
      continue;
    }

    if (
      token.startsWith("--detector=") ||
      token.startsWith("--view=") ||
      token.startsWith("--format=") ||
      token.startsWith("--path=")
    ) {
      const separatorIndex = token.indexOf("=");
      const optionName = token.slice(2, separatorIndex) as "detector" | "view" | "format" | "path";
      const value = token.slice(separatorIndex + 1);
      if (value.length === 0) {
        return {
          ok: false,
          message: `\`--${optionName}\` requires a value.`,
        };
      }
      const error = consumeValue(optionName, value);
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
    return {
      ok: false,
      message: `\`--${expects}\` requires a value.`,
    };
  }

  if (path && textTokens.length > 0) {
    return {
      ok: false,
      message: "`inspect` accepts either positional text or one `--path <file>`, not both.",
    };
  }

  if (!path && textTokens.length === 0) {
    return {
      ok: false,
      message: "No inspect input provided. Pass text or use --path <file>.",
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
    ...(path ? { path } : {}),
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

async function loadInspectInput(path: string | undefined, textTokens: string[]): Promise<{
  text: string;
  sourceType: "inline" | "path";
  path?: string;
}> {
  if (path) {
    let stats;
    try {
      stats = await stat(path);
    } catch (error) {
      throw new Error(formatInputReadError(error));
    }

    if (!stats.isFile()) {
      throw new Error("`inspect --path` requires a regular file.");
    }

    try {
      return {
        text: await readFile(path, "utf8"),
        sourceType: "path",
        path,
      };
    } catch (error) {
      throw new Error(formatInputReadError(error));
    }
  }

  return {
    text: textTokens.join(" "),
    sourceType: "inline",
  };
}

function printInspectStandard(result: DetectorInspectResult): void {
  console.log("Detector inspect");
  console.log(`View: ${result.view}`);
  console.log(`Detector: ${result.detector}`);
  console.log("");
  console.log("Input");
  console.log(`Source: ${result.input.sourceType}`);
  if (result.input.path) {
    console.log(`Path: ${result.input.path}`);
  }
  console.log(`Text length: ${result.input.textLength}`);

  if (result.view === "engine") {
    const samplePreview = createInspectPreview(result.sample.text);
    const normalizedPreview = createInspectPreview(result.sample.normalizedText);

    console.log("");
    console.log("Sample");
    console.log(`Text source: ${result.sample.textSource}`);
    console.log(`Sample text preview: ${JSON.stringify(samplePreview.textPreview)}`);
    console.log(`Sample text truncated: ${samplePreview.textPreviewTruncated}`);
    console.log(`Normalized text preview: ${JSON.stringify(normalizedPreview.textPreview)}`);
    console.log(`Normalized text truncated: ${normalizedPreview.textPreviewTruncated}`);
    if (result.sample.borrowedContext) {
      console.log(`Borrowed context: ${JSON.stringify(result.sample.borrowedContext)}`);
    }
    if (result.routeTag) {
      console.log(`Route tag: ${result.routeTag}`);
    }
    if (result.engine) {
      console.log("");
      console.log("Engine");
      console.log(
        `Raw: ${result.engine.raw.lang}/${result.engine.raw.script} confidence=${result.engine.raw.confidence} reliable=${result.engine.raw.reliable}`,
      );
      if (result.engine.normalized) {
        console.log(
          `Normalized: ${result.engine.normalized.lang}/${result.engine.normalized.script} confidence=${result.engine.normalized.confidence} reliable=${result.engine.normalized.reliable}`,
        );
      }
      console.log(
        `Remap: raw=${result.engine.remapped.rawTag ?? "null"} normalized=${result.engine.remapped.normalizedTag ?? "null"}`,
      );
    } else if (result.decision?.kind === "empty") {
      console.log("");
      console.log(`Decision: ${result.decision.notes.join(" ")}`);
    }
    return;
  }

  console.log("");
  console.log("Chunks");
  if (result.chunks.length === 0) {
    console.log("(none)");
  } else {
    for (const chunk of result.chunks) {
      const source = chunk.source ? ` | ${chunk.source}` : "";
      const reason = chunk.reason ? ` | ${chunk.reason}` : "";
      console.log(
        `[${chunk.index}] ${chunk.locale}${source}${reason} | ${JSON.stringify(chunk.textPreview)}`,
      );
    }
  }

  if (result.windows) {
    for (const window of result.windows) {
      console.log("");
      console.log(`Window ${window.windowIndex}`);
      console.log(`Route: ${window.routeTag}`);
      console.log(`Chunk range: ${window.chunkRange.start}-${window.chunkRange.end}`);
      console.log(`Focus: ${JSON.stringify(window.focusTextPreview)}`);
      if (window.diagnosticSample.borrowedContext) {
        console.log(`Borrowed context: ${JSON.stringify(window.diagnosticSample.borrowedContext)}`);
      }
      console.log(`Sample: ${JSON.stringify(window.diagnosticSample.textPreview)}`);
      console.log(`Normalized sample: ${JSON.stringify(window.diagnosticSample.normalizedTextPreview)}`);
      console.log(
        `Eligibility: ${window.eligibility.scriptChars}/${window.eligibility.minScriptChars} passed=${window.eligibility.passed}`,
      );
      console.log(
        `Content gate: ${window.contentGate.policy} applied=${window.contentGate.applied} passed=${window.contentGate.passed}`,
      );
      console.log(
        `Engine: ${window.engine.executed ? "executed" : `skipped (${window.engine.reason ?? "unknown"})`}`,
      );
      console.log(
        `Decision: accepted=${window.decision.accepted} path=${window.decision.path ?? "null"} final=${window.decision.finalTag} fallback=${window.decision.fallbackReason ?? "null"}`,
      );
    }
  }

  if (result.decision) {
    console.log("");
    if ("kind" in result.decision) {
      console.log(`Decision: ${result.decision.kind}`);
      console.log(result.decision.notes.join(" "));
    }
  }

  console.log("");
  console.log("Resolved");
  if (result.resolvedChunks.length === 0) {
    console.log("(none)");
    return;
  }
  for (const chunk of result.resolvedChunks) {
    console.log(`[${chunk.index}] ${chunk.locale} | ${JSON.stringify(chunk.textPreview)}`);
  }
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
    const input = await loadInspectInput(validated.path, validated.textTokens);
    const result = await inspectTextWithDetector(input.text, {
      detector: validated.detector,
      view: validated.view,
      input: {
        sourceType: input.sourceType,
        ...(input.path ? { path: input.path } : {}),
      },
    });

    if (validated.format === "json") {
      console.log(JSON.stringify(result));
    } else {
      printInspectStandard(result);
    }
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`error: ${message}`));
    process.exitCode = 1;
  }
}
