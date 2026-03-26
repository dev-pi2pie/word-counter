export {
  discoverConfigFileInDirectory,
  discoverConfigFiles,
  resolveUserConfigDirectory,
} from "./discover";
export { applyConfigToCountOptions, applyConfigToInspectInvocation } from "./apply";
export { resolveEnvConfig } from "./env";
export { mergeWordCounterConfig } from "./merge";
export { CONFIG_FILE_BASENAME, CONFIG_FILENAMES, CONFIG_FORMAT_PRIORITY } from "./schema";
export { loadConfigFile, parseConfigText } from "./parse";
export { normalizeWordCounterConfig } from "./normalize";
export { resolveWordCounterConfig } from "./resolve";
export { deriveCountCliSources } from "./sources";
export type {
  ConfigDiscoveryResult,
  ConfigFormat,
  ConfigScope,
  DiscoveredConfigFile,
  ParsedConfigFile,
  WordCounterConfig,
} from "./types";
