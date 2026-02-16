import { type Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { appendAll } from "../../utils/append-all";
import type { DebugChannel } from "../debug/channel";
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
  debug?: DebugChannel;
};

async function expandDirectory(
  directoryPath: string,
  recursive: boolean,
  filter: DirectoryExtensionFilter,
  skipped: BatchSkip[],
  debug: DebugChannel,
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
      if (!shouldIncludeFromDirectory(entryPath, filter)) {
        skipped.push({ path: entryPath, reason: "extension excluded" });
        debug.emit("path.resolve.filter.excluded", {
          path: entryPath,
          reason: "extension excluded",
        });
        continue;
      }

      files.push(entryPath);
      debug.emit("path.resolve.expand.include", {
        path: entryPath,
        source: "directory",
      });
      continue;
    }

    if (!entry.isDirectory() || !recursive) {
      continue;
    }

    const nestedFiles = await expandDirectory(entryPath, recursive, filter, skipped, debug);
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
  const resolvedFiles = new Set<string>();
  const extensionFilter =
    options.extensionFilter ?? buildDirectoryExtensionFilter(undefined, undefined);
  const debug =
    options.debug ??
    ({
      enabled: false,
      emit() {
        return;
      },
    } satisfies DebugChannel);

  debug.emit("path.resolve.inputs", {
    inputs: pathInputs.length,
    pathMode: options.pathMode,
    recursive: options.recursive,
  });

  const addResolvedFile = (
    filePath: string,
    details: { source: "direct" | "directory"; input: string },
  ): void => {
    if (resolvedFiles.has(filePath)) {
      debug.emit("path.resolve.dedupe.duplicate", {
        path: filePath,
        source: details.source,
        input: details.input,
      });
      return;
    }

    resolvedFiles.add(filePath);
    debug.emit("path.resolve.dedupe.accept", {
      path: filePath,
      source: details.source,
      input: details.input,
    });
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
      debug.emit("path.resolve.root.expand", {
        root: targetPath,
        recursive: options.recursive,
      });
      const files = await expandDirectory(
        targetPath,
        options.recursive,
        extensionFilter,
        skipped,
        debug,
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

  const files = [...resolvedFiles].sort((left, right) => left.localeCompare(right));
  debug.emit("path.resolve.complete", {
    files: files.length,
    skipped: skipped.length,
    ordering: "absolute-path-ascending",
  });

  return { files, skipped };
}
