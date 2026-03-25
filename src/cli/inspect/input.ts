import { readFile } from "node:fs/promises";
import { parseMarkdown } from "../../markdown";
import { buildDirectoryExtensionFilter } from "../path/filter";
import { isProbablyBinary } from "../path/load";
import { resolveBatchFileEntries } from "../path/resolve";
import { formatInputReadError } from "../runtime/options";
import type { BatchSkip, PathMode } from "../types";
import type { InspectLoadedPathInput, InspectSectionMode, InspectSingleInput } from "./types";

export function selectInspectText(input: string, section: InspectSectionMode): string {
  if (section === "all") {
    return input;
  }

  const parsed = parseMarkdown(input);
  if (section === "frontmatter") {
    return parsed.frontmatter ?? "";
  }

  return parsed.content;
}

export async function loadSingleInspectInput(
  path: string | undefined,
  textTokens: string[],
  section: InspectSectionMode,
): Promise<InspectSingleInput> {
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

export async function loadInspectBatchInputs(
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
      if (entry.source === "direct") {
        failures.push({ path: entry.path, reason: `not readable: ${message}` });
      } else {
        skipped.push({ path: entry.path, reason: `not readable: ${message}` });
      }
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
