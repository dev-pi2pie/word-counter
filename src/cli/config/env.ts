import { parseTotalOfOption } from "../total-of";
import { normalizeWordCounterConfig } from "./normalize";
import type { WordCounterConfig } from "./types";

function parseBooleanEnv(name: string, value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }

  throw new Error(`Invalid value for ${name}: ${value}`);
}

function parseCommaSeparatedEnv(value: string | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  return tokens.length > 0 ? tokens : [];
}

type ConfigPath = NonNullable<WordCounterConfig["path"]>;
type ConfigProgress = NonNullable<WordCounterConfig["progress"]>;
type ConfigLogging = NonNullable<WordCounterConfig["logging"]>;

export function resolveEnvConfig(env: NodeJS.ProcessEnv = process.env): WordCounterConfig {
  const pathMode = env.WORD_COUNTER_PATH_MODE;
  const recursive = parseBooleanEnv("WORD_COUNTER_RECURSIVE", env.WORD_COUNTER_RECURSIVE);
  const includeExtensions = parseCommaSeparatedEnv(env.WORD_COUNTER_INCLUDE_EXT);
  const excludeExtensions = parseCommaSeparatedEnv(env.WORD_COUNTER_EXCLUDE_EXT);
  const skippedFiles = parseBooleanEnv("WORD_COUNTER_REPORT_SKIPS", env.WORD_COUNTER_REPORT_SKIPS);
  const totalOfRaw = env.WORD_COUNTER_TOTAL_OF;
  const contentGateMode = env.WORD_COUNTER_CONTENT_GATE;
  const progressMode = env.WORD_COUNTER_PROGRESS;
  const logLevel = env.WORD_COUNTER_LOG_LEVEL;
  const logVerbosity = env.WORD_COUNTER_LOG_VERBOSITY;
  const debugReportPath = env.WORD_COUNTER_DEBUG_REPORT;
  const debugReportTee = parseBooleanEnv(
    "WORD_COUNTER_DEBUG_REPORT_TEE",
    env.WORD_COUNTER_DEBUG_REPORT_TEE,
  );

  const config: WordCounterConfig = {};

  if (
    pathMode !== undefined ||
    recursive !== undefined ||
    includeExtensions !== undefined ||
    excludeExtensions !== undefined
  ) {
    config.path = {};
    if (pathMode !== undefined) {
      config.path.mode = pathMode as ConfigPath["mode"];
    }
    if (recursive !== undefined) {
      config.path.recursive = recursive;
    }
    if (includeExtensions !== undefined) {
      config.path.includeExtensions = includeExtensions;
    }
    if (excludeExtensions !== undefined) {
      config.path.excludeExtensions = excludeExtensions;
    }
  }

  if (progressMode !== undefined) {
    config.progress = {
      mode: progressMode as ConfigProgress["mode"],
    };
  }

  if (totalOfRaw !== undefined) {
    config.output = {
      totalOf: parseTotalOfOption(totalOfRaw),
    };
  }

  if (contentGateMode !== undefined) {
    config.contentGate = {
      mode: contentGateMode as NonNullable<WordCounterConfig["contentGate"]>["mode"],
    };
    config.inspect = {
      ...(config.inspect ?? {}),
      contentGate: {
        mode: contentGateMode as NonNullable<
          NonNullable<WordCounterConfig["inspect"]>["contentGate"]
        >["mode"],
      },
    };
  }

  if (skippedFiles !== undefined || debugReportPath !== undefined || debugReportTee !== undefined) {
    config.reporting = {};
    if (skippedFiles !== undefined) {
      config.reporting.skippedFiles = skippedFiles;
    }
    if (debugReportPath !== undefined || debugReportTee !== undefined) {
      config.reporting.debugReport = {};
      if (debugReportPath !== undefined) {
        config.reporting.debugReport.path = debugReportPath;
      }
      if (debugReportTee !== undefined) {
        config.reporting.debugReport.tee = debugReportTee;
      }
    }
  }

  if (logLevel !== undefined || logVerbosity !== undefined) {
    config.logging = {};
    if (logLevel !== undefined) {
      config.logging.level = logLevel as ConfigLogging["level"];
    }
    if (logVerbosity !== undefined) {
      config.logging.verbosity = logVerbosity as ConfigLogging["verbosity"];
    }
  }

  return normalizeWordCounterConfig(config, "environment variables");
}
