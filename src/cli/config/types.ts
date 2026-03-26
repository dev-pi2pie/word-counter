import type { DetectorMode } from "../../detector";
import type { TotalOfPart } from "../total-of";
import type { PathMode } from "../types";

export type ConfigFormat = "toml" | "json" | "jsonc";
export type ConfigScope = "user" | "cwd";
export type ConfigProgressMode = "auto" | "on" | "off";
export type ConfigLogLevel = "info" | "debug";
export type ConfigLogVerbosity = "compact" | "verbose";

export type WordCounterConfig = {
  detector?: DetectorMode;
  inspect?: {
    detector?: DetectorMode;
  };
  path?: {
    mode?: PathMode;
    recursive?: boolean;
    includeExtensions?: string[];
    excludeExtensions?: string[];
    detectBinary?: boolean;
  };
  progress?: {
    mode?: ConfigProgressMode;
  };
  output?: {
    totalOf?: TotalOfPart[];
  };
  reporting?: {
    skippedFiles?: boolean;
    debugReport?: {
      path?: string;
      tee?: boolean;
    };
  };
  logging?: {
    level?: ConfigLogLevel;
    verbosity?: ConfigLogVerbosity;
  };
};

export type ParsedConfigFile = {
  format: ConfigFormat;
  path: string;
  config: WordCounterConfig;
};

export type DiscoveredConfigFile = {
  scope: ConfigScope;
  directory: string;
  path: string;
  format: ConfigFormat;
  ignoredSiblingPaths: string[];
  notes: string[];
};

export type ConfigDiscoveryResult = {
  user?: DiscoveredConfigFile;
  cwd?: DiscoveredConfigFile;
};

export type ResolveConfigDirectoryOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
};

export type DiscoverConfigOptions = ResolveConfigDirectoryOptions & {
  cwd?: string;
};
