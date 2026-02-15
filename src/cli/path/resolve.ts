import { type Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import type { BatchSkip, PathMode } from "../types";
import {
  buildDirectoryExtensionFilter,
  type DirectoryExtensionFilter,
  shouldIncludeFromDirectory,
} from "./filter";

type ResolveBatchFilePathOptions = {
  pathMode: PathMode;
  recursive: boolean;
  extensionFilter?: DirectoryExtensionFilter;
};

async function expandDirectory(
  directoryPath: string,
  recursive: boolean,
  filter: DirectoryExtensionFilter,
  skipped: BatchSkip[],
): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    skipped.push({ path: directoryPath, reason: `directory read failed: ${message}` });
    return [];
  }

  const sortedEntries = entries.slice().sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = resolvePath(directoryPath, entry.name);

    if (entry.isFile()) {
      if (!shouldIncludeFromDirectory(entryPath, filter)) {
        skipped.push({ path: entryPath, reason: "extension excluded" });
        continue;
      }

      files.push(entryPath);
      continue;
    }

    if (!entry.isDirectory() || !recursive) {
      continue;
    }

    const nestedFiles = await expandDirectory(entryPath, recursive, filter, skipped);
    files.push(...nestedFiles);
  }

  return files;
}

export async function resolveBatchFilePaths(
  pathInputs: string[],
  options: ResolveBatchFilePathOptions,
): Promise<{ files: string[]; skipped: BatchSkip[] }> {
  const skipped: BatchSkip[] = [];
  const resolvedFiles: string[] = [];
  const extensionFilter =
    options.extensionFilter ?? buildDirectoryExtensionFilter(undefined, undefined);

  for (const rawPath of pathInputs) {
    const targetPath = resolvePath(rawPath);
    let metadata: Awaited<ReturnType<typeof stat>>;

    try {
      metadata = await stat(targetPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({ path: targetPath, reason: `not readable: ${message}` });
      continue;
    }

    if (metadata.isDirectory() && options.pathMode === "auto") {
      const files = await expandDirectory(targetPath, options.recursive, extensionFilter, skipped);
      resolvedFiles.push(...files);
      continue;
    }

    if (!metadata.isFile()) {
      skipped.push({ path: targetPath, reason: "not a regular file" });
      continue;
    }

    resolvedFiles.push(targetPath);
  }

  resolvedFiles.sort((left, right) => left.localeCompare(right));

  return { files: resolvedFiles, skipped };
}
