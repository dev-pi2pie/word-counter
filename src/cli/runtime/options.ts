import { readFileSync } from "node:fs";
import {
  requiresNonWordCollection,
  requiresWhitespaceCollection,
} from "../total-of";
import type { BatchScope } from "../types";
import type { LatinHintRule } from "../../wc";
import type { CliActionOptions, ResolvedCountRunOptions } from "./types";

export function hasPathInput(pathValues: string[] | undefined): pathValues is string[] {
  return Array.isArray(pathValues) && pathValues.length > 0;
}

function countLongOptionOccurrences(argv: string[], optionName: string): number {
  let count = 0;
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }
    if (token === "--") {
      break;
    }

    if (token === optionName) {
      count += 1;
      // Consume the next token as this option's value so literal values like
      // "--regex=foo" are not misread as a second option occurrence.
      index += 1;
      continue;
    }

    if (token.startsWith(`${optionName}=`)) {
      count += 1;
      continue;
    }
  }

  return count;
}

export function validateSingleRegexOptionUsage(argv: string[]): void {
  if (countLongOptionOccurrences(argv, "--regex") > 1) {
    throw new Error("`--regex` can only be provided once.");
  }
}

export function resolveBatchScope(argv: string[]): BatchScope {
  let scope: BatchScope = "merged";
  for (const token of argv) {
    if (token === "--merged") {
      scope = "merged";
      continue;
    }

    if (token === "--per-file") {
      scope = "per-file";
    }
  }

  return scope;
}

export function resolveDebugReportPathOption(rawValue: string | boolean | undefined): string | undefined {
  if (rawValue === undefined || rawValue === false) {
    return undefined;
  }

  if (typeof rawValue === "string") {
    return rawValue;
  }

  return undefined;
}

export function parseInlineLatinHintRule(value: string): LatinHintRule {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0) {
    throw new Error("`--latin-hint` must use `<tag>=<pattern>` format.");
  }

  const tag = value.slice(0, separatorIndex).trim();
  const pattern = value.slice(separatorIndex + 1);

  if (!tag) {
    throw new Error("`--latin-hint` tag must be non-empty.");
  }

  if (!pattern) {
    throw new Error("`--latin-hint` pattern must be non-empty.");
  }

  return { tag, pattern };
}

function parseLatinHintsFileRule(
  value: unknown,
  index: number,
  sourcePath: string,
): LatinHintRule {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      `Invalid Latin hint rule at ${sourcePath}#${index}: rule must be an object.`,
    );
  }

  const tag = "tag" in value ? value.tag : undefined;
  const pattern = "pattern" in value ? value.pattern : undefined;
  const priority = "priority" in value ? value.priority : undefined;

  if (typeof tag !== "string" || tag.trim().length === 0) {
    throw new Error(
      `Invalid Latin hint rule at ${sourcePath}#${index}: tag must be a non-empty string.`,
    );
  }

  if (typeof pattern !== "string") {
    throw new Error(
      `Invalid Latin hint rule at ${sourcePath}#${index}: pattern must be a string.`,
    );
  }

  if (priority !== undefined && (typeof priority !== "number" || !Number.isFinite(priority))) {
    throw new Error(
      `Invalid Latin hint rule at ${sourcePath}#${index}: priority must be a finite number.`,
    );
  }

  return {
    tag,
    pattern,
    ...(priority !== undefined ? { priority } : {}),
  };
}

function parseLatinHintsFile(path: string): LatinHintRule[] {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Latin hint file (${path}): ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in Latin hint file (${path}): ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Latin hint file (${path}) must contain a JSON array.`);
  }

  return parsed.map((rule, index) => parseLatinHintsFileRule(rule, index, path));
}

function resolveLatinHintRules(options: CliActionOptions): LatinHintRule[] | undefined {
  const inlineRules = (options.latinHint ?? []).map((value) => parseInlineLatinHintRule(value));
  const fileRules =
    typeof options.latinHintsFile === "string" && options.latinHintsFile.length > 0
      ? parseLatinHintsFile(options.latinHintsFile)
      : [];

  const mergedRules = [...inlineRules, ...fileRules];
  if (mergedRules.length === 0) {
    return undefined;
  }

  return mergedRules;
}

export function resolveCountRunOptions(options: CliActionOptions): ResolvedCountRunOptions {
  const useSection = options.section !== "all";
  const totalOfParts = options.totalOf;
  const requestedNonWords = Boolean(options.nonWords || options.includeWhitespace || options.misc);
  const collectNonWordsForOverride = requiresNonWordCollection(totalOfParts);
  const collectWhitespaceForOverride = requiresWhitespaceCollection(totalOfParts);
  const enableNonWords = Boolean(
    options.nonWords || options.includeWhitespace || options.misc || collectNonWordsForOverride,
  );
  const enableWhitespace = Boolean(
    options.includeWhitespace || options.misc || collectWhitespaceForOverride,
  );
  const shouldNormalizeBaseOutput = !requestedNonWords && enableNonWords;

  return {
    useSection,
    totalOfParts,
    requestedNonWords,
    shouldNormalizeBaseOutput,
    wcOptions: {
      mode: options.mode,
      latinLanguageHint: options.latinLanguage,
      latinTagHint: options.latinTag,
      latinLocaleHint: options.latinLocale,
      latinHintRules: resolveLatinHintRules(options),
      useDefaultLatinHints: options.defaultLatinHints !== false,
      hanLanguageHint: options.hanLanguage,
      hanTagHint: options.hanTag,
      nonWords: enableNonWords,
      includeWhitespace: enableWhitespace,
    },
  };
}

export function formatInputReadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to read input: ${message}`;
}
