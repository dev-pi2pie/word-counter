import type { DetectorInspectView } from "../../detector/inspect-types";
import type { DetectorContentGateMode } from "../../detector";
import type { PathMode } from "../types";
import type {
  InspectDetectorMode,
  InspectOutputFormat,
  InspectSectionMode,
  ValidInspectInvocation,
} from "./types";

function parseDetector(rawValue: string | undefined): InspectDetectorMode | null {
  if (rawValue === undefined) {
    return "regex";
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

function parseContentGateMode(rawValue: string | undefined): DetectorContentGateMode | null {
  if (rawValue === undefined) {
    return "default";
  }
  if (
    rawValue === "default" ||
    rawValue === "strict" ||
    rawValue === "loose" ||
    rawValue === "off"
  ) {
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

function isInvalidInspectDetectorViewCombination(
  detector: InspectDetectorMode,
  view: DetectorInspectView,
): boolean {
  return view === "engine" && detector === "regex";
}

export function validateInspectInvocation(argv: string[]): ValidInspectInvocation {
  const inspectIndex = argv.findIndex((token, index) => index >= 2 && token === "inspect");
  const tokens = inspectIndex >= 0 ? argv.slice(inspectIndex + 1) : [];
  let detector: InspectDetectorMode = "regex";
  let contentGateMode: DetectorContentGateMode = "default";
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
  const sources = {
    detector: false,
    contentGate: false,
    pathMode: false,
    recursive: false,
    includeExt: false,
    excludeExt: false,
  };
  let expects:
    | "detector"
    | "view"
    | "contentGate"
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
      | "contentGate"
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
      sources.detector = true;
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

    if (kind === "contentGate") {
      const parsed = parseContentGateMode(value);
      if (parsed === null) {
        return "`--content-gate` must be `default`, `strict`, `loose`, or `off`.";
      }
      contentGateMode = parsed;
      sources.contentGate = true;
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
      sources.pathMode = true;
      return null;
    }

    if (kind === "path") {
      paths.push(value);
      return null;
    }

    if (kind === "includeExt") {
      includeExt.push(value);
      sources.includeExt = true;
      return null;
    }

    if (kind === "excludeExt") {
      excludeExt.push(value);
      sources.excludeExt = true;
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
      sources.recursive = true;
      continue;
    }

    if (token === "--pretty") {
      pretty = true;
      continue;
    }

    if (
      token === "--detector" ||
      token === "-d" ||
      token === "--content-gate" ||
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
          : token === "-d"
            ? "detector"
            : token === "--content-gate"
              ? "contentGate"
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
      token.startsWith("--content-gate=") ||
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
                  | "content-gate"
                  | "view"
                  | "format"
                  | "section"
                  | "path"
                  | "regex");
      const normalizedNamedOption =
        normalizedOption === "content-gate" ? "contentGate" : normalizedOption;

      const error = consumeValue(
        normalizedNamedOption as
          | "detector"
          | "contentGate"
          | "view"
          | "format"
          | "section"
          | "path"
          | "regex"
          | "pathMode"
          | "includeExt"
          | "excludeExt",
        value,
      );
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
        : expects === "contentGate"
          ? "content-gate"
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

  if (isInvalidInspectDetectorViewCombination(detector, view)) {
    return {
      ok: false,
      message: "`--view engine` requires `--detector wasm`.",
    };
  }

  return {
    ok: true,
    detector,
    contentGateMode,
    view,
    format,
    pretty,
    section,
    pathMode,
    pathDetectBinary: true,
    recursive,
    includeExt,
    excludeExt,
    ...(regex !== undefined ? { regex } : {}),
    paths,
    textTokens,
    sources,
  };
}
