import { stat } from "node:fs/promises";
import { join, win32 } from "node:path";
import { CONFIG_FILE_BASENAME, CONFIG_FILENAMES, CONFIG_FORMAT_PRIORITY } from "./schema";
import type {
  ConfigDiscoveryResult,
  ConfigFormat,
  ConfigScope,
  DiscoverConfigOptions,
  DiscoveredConfigFile,
  ResolveConfigDirectoryOptions,
} from "./types";

type UserConfigDirectoryCandidate = {
  directory: string;
  kind: "primary" | "legacy-macos" | "legacy-windows";
};

async function fileExists(path: string): Promise<boolean> {
  try {
    const metadata = await stat(path);
    return metadata.isFile();
  } catch {
    return false;
  }
}

function createIgnoredSiblingNote(
  scope: ConfigScope,
  selectedPath: string,
  ignoredSiblingPaths: string[],
): string | undefined {
  if (ignoredSiblingPaths.length === 0) {
    return undefined;
  }

  return [
    `Using ${scope} config file "${selectedPath}".`,
    `Ignoring lower-priority sibling config files: ${ignoredSiblingPaths.join(", ")}.`,
  ].join(" ");
}

export function resolveUserConfigDirectory(
  options: ResolveConfigDirectoryOptions = {},
): string | undefined {
  return resolveUserConfigDirectories(options)[0]?.directory;
}

function resolveUserConfigDirectories(
  options: ResolveConfigDirectoryOptions = {},
): UserConfigDirectoryCandidate[] {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = env.HOME ?? env.USERPROFILE;

  if (platform === "win32") {
    const candidates: UserConfigDirectoryCandidate[] = [];
    if (homeDir) {
      candidates.push({
        directory: win32.join(homeDir, ".config"),
        kind: "primary",
      });
    }
    if (env.APPDATA) {
      candidates.push({
        directory: env.APPDATA,
        kind: "legacy-windows",
      });
    }
    return candidates;
  }

  if (platform === "darwin") {
    const candidates: UserConfigDirectoryCandidate[] = [];
    if (env.XDG_CONFIG_HOME) {
      candidates.push({
        directory: env.XDG_CONFIG_HOME,
        kind: "primary",
      });
    }
    if (homeDir) {
      candidates.push({
        directory: join(homeDir, ".config"),
        kind: "primary",
      });
      candidates.push({
        directory: join(homeDir, "Library", "Application Support"),
        kind: "legacy-macos",
      });
    }
    return candidates;
  }

  const directory = env.XDG_CONFIG_HOME ?? (homeDir ? join(homeDir, ".config") : undefined);
  return directory
    ? [
        {
          directory,
          kind: "primary",
        },
      ]
    : [];
}

export async function discoverConfigFileInDirectory(
  directory: string,
  scope: ConfigScope,
): Promise<DiscoveredConfigFile | undefined> {
  const existing: Array<{ format: ConfigFormat; path: string }> = [];

  for (const format of CONFIG_FORMAT_PRIORITY) {
    const path = join(directory, `${CONFIG_FILE_BASENAME}.${format}`);
    if (await fileExists(path)) {
      existing.push({ format, path });
    }
  }

  if (existing.length === 0) {
    return undefined;
  }

  const selected = existing[0]!;
  const ignoredSiblingPaths = existing.slice(1).map((item) => item.path);
  const note = createIgnoredSiblingNote(scope, selected.path, ignoredSiblingPaths);

  return {
    scope,
    directory,
    path: selected.path,
    format: selected.format,
    ignoredSiblingPaths,
    notes: note ? [note] : [],
  };
}

export async function discoverConfigFiles(
  options: DiscoverConfigOptions = {},
): Promise<ConfigDiscoveryResult> {
  const cwd = options.cwd ?? process.cwd();
  const userDirectories = resolveUserConfigDirectories(options);

  const currentWorkingDirectory = await discoverConfigFileInDirectory(cwd, "cwd");
  let user: DiscoveredConfigFile | undefined;
  const discoveredFallbackUsers: DiscoveredConfigFile[] = [];

  for (const candidate of userDirectories) {
    const discovered = await discoverConfigFileInDirectory(candidate.directory, "user");
    if (!discovered) {
      continue;
    }

    if (!user) {
      user = discovered;
      if (candidate.kind === "legacy-macos") {
        user.notes.push(
          `Using legacy macOS user config location "${discovered.directory}". Migrate this config to "${resolveUserConfigDirectory(options)}" to follow the current default path.`,
        );
      }
      if (candidate.kind === "legacy-windows") {
        user.notes.push(
          `Using legacy Windows user config location "${discovered.directory}". Migrate this config to "${resolveUserConfigDirectory(options)}" to follow the current default path.`,
        );
      }
      continue;
    }

    discoveredFallbackUsers.push(discovered);
  }

  if (user) {
    for (const fallback of discoveredFallbackUsers) {
      user.notes.push(
        `Ignoring fallback user config file "${fallback.path}" because a higher-priority user config file was found at "${user.path}".`,
      );
    }
  }

  return {
    ...(user ? { user } : {}),
    ...(currentWorkingDirectory ? { cwd: currentWorkingDirectory } : {}),
  };
}

export { CONFIG_FILENAMES };
