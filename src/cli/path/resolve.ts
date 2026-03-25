import { stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import type { BatchResolvedFile, BatchResolvedSkip, BatchSkip } from "../types";
import {
  buildDirectoryRegexFilter,
  buildDirectoryExtensionFilter,
  type DirectoryRegexFilter,
} from "./filter";
import {
  createPathResolveDebugStats,
  emitPathResolveSummaries,
  resolvePathDebugChannel,
} from "./resolve-debug";
import { expandDirectory } from "./resolve-directory";
import type { PathResolveDebugStats, ResolveBatchFilePathOptions } from "./resolve-types";

export async function resolveBatchFileEntries(
  pathInputs: string[],
  options: ResolveBatchFilePathOptions,
): Promise<{ files: BatchResolvedFile[]; skipped: BatchResolvedSkip[] }> {
  const skipped: BatchResolvedSkip[] = [];
  const regexExcludedPaths = new Set<string>();
  const resolvedFiles = new Map<string, BatchResolvedFile>();
  const stats: PathResolveDebugStats = createPathResolveDebugStats();
  const extensionFilter =
    options.extensionFilter ?? buildDirectoryExtensionFilter(undefined, undefined);
  let regexFilter: DirectoryRegexFilter | undefined;
  const debug = resolvePathDebugChannel(options.debug);

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

    const existing = resolvedFiles.get(filePath);
    if (existing) {
      if (existing.source === "directory" && details.source === "direct") {
        resolvedFiles.set(filePath, {
          path: filePath,
          source: "direct",
        });
      }
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

    resolvedFiles.set(filePath, {
      path: filePath,
      source: details.source,
    });
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
      skipped.push({ path: targetPath, reason: `not readable: ${message}`, source: "direct" });
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
        {
          rootPath: targetPath,
          directoryPath: targetPath,
          recursive: options.recursive,
          extensionFilter,
          regexFilter: effectiveRegexFilter,
        },
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
      skipped.push({ path: targetPath, reason: "not a regular file", source: "direct" });
      debug.emit("path.resolve.skip", {
        path: targetPath,
        reason: "not a regular file",
      });
      continue;
    }

    addResolvedFile(targetPath, { source: "direct", input: targetPath });
  }

  for (const path of regexExcludedPaths) {
    skipped.push({ path, reason: "regex excluded", source: "directory" });
  }

  const files = [...resolvedFiles.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  emitPathResolveSummaries(debug, stats, files.length, skipped.length);

  return { files, skipped };
}

export async function resolveBatchFilePaths(
  pathInputs: string[],
  options: ResolveBatchFilePathOptions,
): Promise<{ files: string[]; skipped: BatchSkip[] }> {
  const resolved = await resolveBatchFileEntries(pathInputs, options);
  return {
    files: resolved.files.map((file) => file.path),
    skipped: resolved.skipped.map(({ path, reason }) => ({ path, reason })),
  };
}
