import type { DetectorMode } from "../../detector";
import type { TotalOfPart } from "../total-of";
import type { PathMode } from "../types";
import { ConfigValidationError } from "./errors";
import {
  CONFIG_DETECTOR_VALUES,
  CONFIG_LOG_LEVEL_VALUES,
  CONFIG_LOG_VERBOSITY_VALUES,
  CONFIG_PATH_MODE_VALUES,
  CONFIG_PROGRESS_MODE_VALUES,
  CONFIG_TOTAL_OF_VALUES,
} from "./schema";
import type {
  ConfigLogLevel,
  ConfigLogVerbosity,
  ConfigProgressMode,
  WordCounterConfig,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createConfigError(sourceLabel: string, path: string[], message: string): Error {
  return new ConfigValidationError(sourceLabel, path, message);
}

function ensureObject(
  value: unknown,
  sourceLabel: string,
  path: string[],
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw createConfigError(sourceLabel, path, "expected an object.");
  }

  return value;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  sourceLabel: string,
  path: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw createConfigError(sourceLabel, [...path, key], "unknown key.");
    }
  }
}

function parseBoolean(value: unknown, sourceLabel: string, path: string[]): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw createConfigError(sourceLabel, path, "expected a boolean.");
  }

  return value;
}

function parseString(value: unknown, sourceLabel: string, path: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createConfigError(sourceLabel, path, "expected a string.");
  }

  return value;
}

function parseStringArray(
  value: unknown,
  sourceLabel: string,
  path: string[],
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw createConfigError(sourceLabel, path, "expected an array of strings.");
  }

  return [...value];
}

function parseEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  sourceLabel: string,
  path: string[],
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw createConfigError(
      sourceLabel,
      path,
      `expected one of: ${allowedValues.map((item) => `"${item}"`).join(", ")}.`,
    );
  }

  return value as T;
}

function parseTotalOf(
  value: unknown,
  sourceLabel: string,
  path: string[],
): TotalOfPart[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw createConfigError(sourceLabel, path, "expected an array of strings.");
  }

  const parts: TotalOfPart[] = [];
  for (const item of value) {
    const parsed = parseEnum(item, CONFIG_TOTAL_OF_VALUES, sourceLabel, path);
    if (parsed && !parts.includes(parsed)) {
      parts.push(parsed);
    }
  }

  return parts;
}

function normalizeInspectConfig(value: unknown, sourceLabel: string): WordCounterConfig["inspect"] {
  const section = ensureObject(value, sourceLabel, ["inspect"]);
  if (!section) {
    return undefined;
  }

  rejectUnknownKeys(section, ["detector"], sourceLabel, ["inspect"]);

  const detector = parseEnum<DetectorMode>(section.detector, CONFIG_DETECTOR_VALUES, sourceLabel, [
    "inspect",
    "detector",
  ]);

  return detector === undefined ? undefined : { detector };
}

function normalizePathConfig(value: unknown, sourceLabel: string): WordCounterConfig["path"] {
  const section = ensureObject(value, sourceLabel, ["path"]);
  if (!section) {
    return undefined;
  }

  rejectUnknownKeys(
    section,
    ["mode", "recursive", "includeExtensions", "excludeExtensions", "detectBinary"],
    sourceLabel,
    ["path"],
  );

  const mode = parseEnum<PathMode>(section.mode, CONFIG_PATH_MODE_VALUES, sourceLabel, [
    "path",
    "mode",
  ]);
  const recursive = parseBoolean(section.recursive, sourceLabel, ["path", "recursive"]);
  const includeExtensions = parseStringArray(section.includeExtensions, sourceLabel, [
    "path",
    "includeExtensions",
  ]);
  const excludeExtensions = parseStringArray(section.excludeExtensions, sourceLabel, [
    "path",
    "excludeExtensions",
  ]);
  const detectBinary = parseBoolean(section.detectBinary, sourceLabel, ["path", "detectBinary"]);

  const normalized: NonNullable<WordCounterConfig["path"]> = {};
  if (mode !== undefined) {
    normalized.mode = mode;
  }
  if (recursive !== undefined) {
    normalized.recursive = recursive;
  }
  if (includeExtensions !== undefined) {
    normalized.includeExtensions = includeExtensions;
  }
  if (excludeExtensions !== undefined) {
    normalized.excludeExtensions = excludeExtensions;
  }
  if (detectBinary !== undefined) {
    normalized.detectBinary = detectBinary;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeProgressConfig(
  value: unknown,
  sourceLabel: string,
): WordCounterConfig["progress"] {
  const section = ensureObject(value, sourceLabel, ["progress"]);
  if (!section) {
    return undefined;
  }

  rejectUnknownKeys(section, ["mode"], sourceLabel, ["progress"]);

  const mode = parseEnum<ConfigProgressMode>(
    section.mode,
    CONFIG_PROGRESS_MODE_VALUES,
    sourceLabel,
    ["progress", "mode"],
  );

  return mode === undefined ? undefined : { mode };
}

function normalizeOutputConfig(value: unknown, sourceLabel: string): WordCounterConfig["output"] {
  const section = ensureObject(value, sourceLabel, ["output"]);
  if (!section) {
    return undefined;
  }

  rejectUnknownKeys(section, ["totalOf"], sourceLabel, ["output"]);

  const totalOf = parseTotalOf(section.totalOf, sourceLabel, ["output", "totalOf"]);
  return totalOf === undefined ? undefined : { totalOf };
}

function normalizeReportingConfig(
  value: unknown,
  sourceLabel: string,
): WordCounterConfig["reporting"] {
  const section = ensureObject(value, sourceLabel, ["reporting"]);
  if (!section) {
    return undefined;
  }

  rejectUnknownKeys(section, ["skippedFiles", "debugReport"], sourceLabel, ["reporting"]);

  const skippedFiles = parseBoolean(section.skippedFiles, sourceLabel, [
    "reporting",
    "skippedFiles",
  ]);

  const debugReportSection = ensureObject(section.debugReport, sourceLabel, [
    "reporting",
    "debugReport",
  ]);
  if (debugReportSection) {
    rejectUnknownKeys(debugReportSection, ["path", "tee"], sourceLabel, [
      "reporting",
      "debugReport",
    ]);
  }

  const path = parseString(debugReportSection?.path, sourceLabel, [
    "reporting",
    "debugReport",
    "path",
  ]);
  const tee = parseBoolean(debugReportSection?.tee, sourceLabel, [
    "reporting",
    "debugReport",
    "tee",
  ]);

  const normalized: NonNullable<WordCounterConfig["reporting"]> = {};
  if (skippedFiles !== undefined) {
    normalized.skippedFiles = skippedFiles;
  }
  if (path !== undefined || tee !== undefined) {
    normalized.debugReport = {};
    if (path !== undefined) {
      normalized.debugReport.path = path;
    }
    if (tee !== undefined) {
      normalized.debugReport.tee = tee;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeLoggingConfig(value: unknown, sourceLabel: string): WordCounterConfig["logging"] {
  const section = ensureObject(value, sourceLabel, ["logging"]);
  if (!section) {
    return undefined;
  }

  rejectUnknownKeys(section, ["level", "verbosity"], sourceLabel, ["logging"]);

  const level = parseEnum<ConfigLogLevel>(section.level, CONFIG_LOG_LEVEL_VALUES, sourceLabel, [
    "logging",
    "level",
  ]);
  const verbosity = parseEnum<ConfigLogVerbosity>(
    section.verbosity,
    CONFIG_LOG_VERBOSITY_VALUES,
    sourceLabel,
    ["logging", "verbosity"],
  );

  const normalized: NonNullable<WordCounterConfig["logging"]> = {};
  if (level !== undefined) {
    normalized.level = level;
  }
  if (verbosity !== undefined) {
    normalized.verbosity = verbosity;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeWordCounterConfig(value: unknown, sourceLabel: string): WordCounterConfig {
  const root = ensureObject(value, sourceLabel, []);
  if (!root) {
    throw createConfigError(sourceLabel, [], "expected a root object.");
  }

  rejectUnknownKeys(
    root,
    ["detector", "inspect", "path", "progress", "output", "reporting", "logging"],
    sourceLabel,
    [],
  );

  const detector = parseEnum<DetectorMode>(root.detector, CONFIG_DETECTOR_VALUES, sourceLabel, [
    "detector",
  ]);
  const inspect = normalizeInspectConfig(root.inspect, sourceLabel);
  const path = normalizePathConfig(root.path, sourceLabel);
  const progress = normalizeProgressConfig(root.progress, sourceLabel);
  const output = normalizeOutputConfig(root.output, sourceLabel);
  const reporting = normalizeReportingConfig(root.reporting, sourceLabel);
  const logging = normalizeLoggingConfig(root.logging, sourceLabel);

  const normalized: WordCounterConfig = {};
  if (detector !== undefined) {
    normalized.detector = detector;
  }
  if (inspect !== undefined) {
    normalized.inspect = inspect;
  }
  if (path !== undefined) {
    normalized.path = path;
  }
  if (progress !== undefined) {
    normalized.progress = progress;
  }
  if (output !== undefined) {
    normalized.output = output;
  }
  if (reporting !== undefined) {
    normalized.reporting = reporting;
  }
  if (logging !== undefined) {
    normalized.logging = logging;
  }

  return normalized;
}
