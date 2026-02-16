import {
  requiresNonWordCollection,
  requiresWhitespaceCollection,
} from "../total-of";
import type { BatchScope } from "../types";
import type { CliActionOptions, ResolvedCountRunOptions } from "./types";

export function hasPathInput(pathValues: string[] | undefined): pathValues is string[] {
  return Array.isArray(pathValues) && pathValues.length > 0;
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
