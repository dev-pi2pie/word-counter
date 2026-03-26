import { loadConfigFile } from "./parse";
import { discoverConfigFiles } from "./discover";
import { resolveEnvConfig } from "./env";
import { mergeWordCounterConfig } from "./merge";
import type { DiscoverConfigOptions, ParsedConfigFile, WordCounterConfig } from "./types";

export type ResolvedWordCounterConfig = {
  config: WordCounterConfig;
  files: ParsedConfigFile[];
  notes: string[];
};

export async function resolveWordCounterConfig(
  options: DiscoverConfigOptions = {},
): Promise<ResolvedWordCounterConfig> {
  const discovered = await discoverConfigFiles(options);
  const filesToLoad = [discovered.user, discovered.cwd].filter((item) => item !== undefined);
  const loadedFiles = await Promise.all(
    filesToLoad.map(async (item) => {
      const loaded = await loadConfigFile(item.path, item.format);
      return {
        ...loaded,
        notes: item.notes,
      };
    }),
  );

  let config: WordCounterConfig = {};
  const files: ParsedConfigFile[] = [];
  const notes: string[] = [];

  for (const loaded of loadedFiles) {
    config = mergeWordCounterConfig(config, loaded.config);
    files.push({
      path: loaded.path,
      format: loaded.format,
      config: loaded.config,
    });
    notes.push(...loaded.notes);
  }

  config = mergeWordCounterConfig(config, resolveEnvConfig(options.env));

  return {
    config,
    files,
    notes,
  };
}
