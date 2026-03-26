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
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = env.HOME ?? env.USERPROFILE;

  if (platform === "win32") {
    return env.APPDATA ?? (homeDir ? win32.join(homeDir, "AppData", "Roaming") : undefined);
  }

  if (platform === "darwin") {
    return homeDir ? join(homeDir, "Library", "Application Support") : undefined;
  }

  return env.XDG_CONFIG_HOME ?? (homeDir ? join(homeDir, ".config") : undefined);
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
  const userDirectory = resolveUserConfigDirectory(options);

  const [user, currentWorkingDirectory] = await Promise.all([
    userDirectory
      ? discoverConfigFileInDirectory(userDirectory, "user")
      : Promise.resolve(undefined),
    discoverConfigFileInDirectory(cwd, "cwd"),
  ]);

  return {
    ...(user ? { user } : {}),
    ...(currentWorkingDirectory ? { cwd: currentWorkingDirectory } : {}),
  };
}

export { CONFIG_FILENAMES };
