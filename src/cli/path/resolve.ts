import { type Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { appendAll } from "../../utils/append-all";
import type { DebugChannel } from "../debug/channel";
import type { BatchSkip, PathMode } from "../types";
import {
  buildDirectoryRegexFilter,
  buildDirectoryExtensionFilter,
  type DirectoryRegexFilter,
  type DirectoryExtensionFilter,
  shouldIncludeFromDirectory,
  shouldIncludeFromDirectoryRegex,
  toDirectoryRelativePath,
} from "./filter";

type ResolveBatchFilePathOptions = {
  pathMode: PathMode;
  recursive: boolean;
  extensionFilter?: DirectoryExtensionFilter;
  directoryRegexPattern?: string;
  debug?: DebugChannel;
};

type PathResolveDebugStats = {
  dedupeAccepted: number;
  dedupeDuplicates: number;
  filterExcluded: number;
  regexExcluded: number;
  directoryIncluded: number;
};

async function expandDirectory(
  rootPath: string,
  directoryPath: string,
  recursive: boolean,
  extensionFilter: DirectoryExtensionFilter,
  regexFilter: DirectoryRegexFilter,
  skipped: BatchSkip[],
  recordRegexExcluded: (filePath: string) => boolean,
  debug: DebugChannel,
  stats: PathResolveDebugStats,
): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    skipped.push({ path: directoryPath, reason: `directory read failed: ${message}` });
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
        skipped.push({ path: entryPath, reason: "extension excluded" });
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
      rootPath,
      entryPath,
      recursive,
      extensionFilter,
      regexFilter,
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

export async function resolveBatchFilePaths(
  pathInputs: string[],
  options: ResolveBatchFilePathOptions,
): Promise<{ files: string[]; skipped: BatchSkip[] }> {
  const skipped: BatchSkip[] = [];
  const regexExcludedPaths = new Set<string>();
  const resolvedFiles = new Set<string>();
  const stats: PathResolveDebugStats = {
    dedupeAccepted: 0,
    dedupeDuplicates: 0,
    filterExcluded: 0,
    regexExcluded: 0,
    directoryIncluded: 0,
  };
  const extensionFilter =
    options.extensionFilter ?? buildDirectoryExtensionFilter(undefined, undefined);
  let regexFilter: DirectoryRegexFilter | undefined;
  const debug =
    options.debug ??
    ({
      enabled: false,
      verbosity: "compact",
      emit() {
        return;
      },
      close: async () => {
        return;
      },
    } satisfies DebugChannel);

  debug.emit("path.resolve.inputs", {
    inputs: pathInputs.length,
    pathMode: options.pathMode,
    recursive: options.recursive,
    hasRegex: Boolean(options.directoryRegexPattern),
  });

  const addResolvedFile = (
    filePath: string,
    details: { source: "direct" | "directory"; input: string },
  ): void => {
    regexExcludedPaths.delete(filePath);

    if (resolvedFiles.has(filePath)) {
      stats.dedupeDuplicates += 1;
      debug.emit(
        "path.resolve.dedupe.duplicate",
        {
          path: filePath,
          source: details.source,
          input: details.input,
        },
        { verbosity: "verbose" },
      );
      return;
    }

    resolvedFiles.add(filePath);
    stats.dedupeAccepted += 1;
    debug.emit(
      "path.resolve.dedupe.accept",
      {
        path: filePath,
        source: details.source,
        input: details.input,
      },
      { verbosity: "verbose" },
    );
  };

  const getRegexFilter = (): DirectoryRegexFilter => {
    if (!regexFilter) {
      regexFilter = buildDirectoryRegexFilter(options.directoryRegexPattern);
    }
    return regexFilter;
  };

  const recordRegexExcluded = (filePath: string): boolean => {
    if (resolvedFiles.has(filePath)) {
      return false;
    }

    regexExcludedPaths.add(filePath);
    return true;
  };

  for (const rawPath of pathInputs) {
    const targetPath = resolvePath(rawPath);
    debug.emit("path.resolve.input", {
      rawPath,
      resolvedPath: targetPath,
    });
    let metadata: Awaited<ReturnType<typeof stat>>;

    try {
      metadata = await stat(targetPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({ path: targetPath, reason: `not readable: ${message}` });
      debug.emit("path.resolve.skip", {
        path: targetPath,
        reason: `not readable: ${message}`,
      });
      continue;
    }

    if (metadata.isDirectory() && options.pathMode === "auto") {
      const effectiveRegexFilter = getRegexFilter();
      debug.emit("path.resolve.root.expand", {
        root: targetPath,
        recursive: options.recursive,
        regex: effectiveRegexFilter.sourcePattern ?? null,
      });
      const files = await expandDirectory(
        targetPath,
        targetPath,
        options.recursive,
        extensionFilter,
        effectiveRegexFilter,
        skipped,
        recordRegexExcluded,
        debug,
        stats,
      );
      for (const file of files) {
        addResolvedFile(file, { source: "directory", input: targetPath });
      }
      continue;
    }

    if (!metadata.isFile()) {
      skipped.push({ path: targetPath, reason: "not a regular file" });
      debug.emit("path.resolve.skip", {
        path: targetPath,
        reason: "not a regular file",
      });
      continue;
    }

    addResolvedFile(targetPath, { source: "direct", input: targetPath });
  }

  for (const path of regexExcludedPaths) {
    skipped.push({ path, reason: "regex excluded" });
  }

  const files = [...resolvedFiles].sort((left, right) => left.localeCompare(right));
  debug.emit("path.resolve.filter.summary", {
    excluded: stats.filterExcluded + stats.regexExcluded,
    extensionExcluded: stats.filterExcluded,
    regexExcluded: stats.regexExcluded,
    included: stats.directoryIncluded,
  });
  debug.emit("path.resolve.dedupe.summary", {
    accepted: stats.dedupeAccepted,
    duplicates: stats.dedupeDuplicates,
  });
  debug.emit("path.resolve.complete", {
    files: files.length,
    skipped: skipped.length,
    ordering: "absolute-path-ascending",
  });

  return { files, skipped };
}
