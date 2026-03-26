export {
  discoverConfigFileInDirectory,
  discoverConfigFiles,
  resolveUserConfigDirectory,
} from "./discover";
export { CONFIG_FILE_BASENAME, CONFIG_FILENAMES, CONFIG_FORMAT_PRIORITY } from "./schema";
export { loadConfigFile, parseConfigText } from "./parse";
export { normalizeWordCounterConfig } from "./normalize";
export type {
  ConfigDiscoveryResult,
  ConfigFormat,
  ConfigScope,
  DiscoveredConfigFile,
  ParsedConfigFile,
  WordCounterConfig,
} from "./types";
