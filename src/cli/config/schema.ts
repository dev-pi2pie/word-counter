import type { DetectorMode } from "../../detector";
import type { TotalOfPart } from "../total-of";
import type { PathMode } from "../types";
import type { ConfigFormat, ConfigLogLevel, ConfigLogVerbosity, ConfigProgressMode } from "./types";

export const CONFIG_FILE_BASENAME = "wc-intl-seg.config";
export const CONFIG_FORMAT_PRIORITY: readonly ConfigFormat[] = ["toml", "jsonc", "json"];
export const CONFIG_FILENAMES = CONFIG_FORMAT_PRIORITY.map(
  (format) => `${CONFIG_FILE_BASENAME}.${format}`,
);

export const CONFIG_DETECTOR_VALUES: readonly DetectorMode[] = ["regex", "wasm"];
export const CONFIG_PATH_MODE_VALUES: readonly PathMode[] = ["auto", "manual"];
export const CONFIG_PROGRESS_MODE_VALUES: readonly ConfigProgressMode[] = ["auto", "on", "off"];
export const CONFIG_LOG_LEVEL_VALUES: readonly ConfigLogLevel[] = ["info", "debug"];
export const CONFIG_LOG_VERBOSITY_VALUES: readonly ConfigLogVerbosity[] = ["compact", "verbose"];

export const CONFIG_TOTAL_OF_VALUES: readonly TotalOfPart[] = [
  "words",
  "emoji",
  "symbols",
  "punctuation",
  "whitespace",
];
