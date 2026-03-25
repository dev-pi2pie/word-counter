import { type Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { appendAll } from "../../utils/append-all";
import type { DebugChannel } from "../debug/channel";
import type { BatchResolvedSkip } from "../types";
import {
  shouldIncludeFromDirectory,
  shouldIncludeFromDirectoryRegex,
  toDirectoryRelativePath,
} from "./filter";
import type { ExpandDirectoryOptions, PathResolveDebugStats } from "./resolve-types";

export async function expandDirectory(
  {
    rootPath,
    directoryPath,
    recursive,
    extensionFilter,
    regexFilter,
  }: ExpandDirectoryOptions,
  skipped: BatchResolvedSkip[],
  recordRegexExcluded: (filePath: string) => boolean,
  debug: DebugChannel,
  stats: PathResolveDebugStats,
): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    skipped.push({ path: directoryPath, reason: `directory read failed: ${message}`, source: "directory" });
    debug.emit("path.resolve.expand.read_failed", {
      directory: directoryPath,
      reason: `directory read failed: ${message}`,
    });
    return [];
  }

  const sortedEntries = entries.slice().sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];
  debug.emit("path.resolve.expand.start", {
    directory: directoryPath,
    entries: sortedEntries.length,
    recursive,
  });

  for (const entry of sortedEntries) {
    const entryPath = resolvePath(directoryPath, entry.name);

    if (entry.isFile()) {
      if (!shouldIncludeFromDirectory(entryPath, extensionFilter)) {
        skipped.push({ path: entryPath, reason: "extension excluded", source: "directory" });
        debug.emit(
          "path.resolve.filter.excluded",
          {
            path: entryPath,
            reason: "extension excluded",
          },
          { verbosity: "verbose" },
        );
        stats.filterExcluded += 1;
        continue;
      }

      const relativePath = toDirectoryRelativePath(rootPath, entryPath);
      if (!shouldIncludeFromDirectoryRegex(relativePath, regexFilter)) {
        if (recordRegexExcluded(entryPath)) {
          debug.emit(
            "path.resolve.regex.excluded",
            {
              path: entryPath,
              relativePath,
              pattern: regexFilter.sourcePattern,
              reason: "regex excluded",
            },
            { verbosity: "verbose" },
          );
          stats.regexExcluded += 1;
        }
        continue;
      }

      files.push(entryPath);
      stats.directoryIncluded += 1;
      debug.emit(
        "path.resolve.expand.include",
        {
          path: entryPath,
          source: "directory",
        },
        { verbosity: "verbose" },
      );
      continue;
    }

    if (!entry.isDirectory() || !recursive) {
      continue;
    }

    const nestedFiles = await expandDirectory(
      {
        rootPath,
        directoryPath: entryPath,
        recursive,
        extensionFilter,
        regexFilter,
      },
      skipped,
      recordRegexExcluded,
      debug,
      stats,
    );
    appendAll(files, nestedFiles);
  }

  debug.emit("path.resolve.expand.complete", {
    directory: directoryPath,
    files: files.length,
  });

  return files;
}
