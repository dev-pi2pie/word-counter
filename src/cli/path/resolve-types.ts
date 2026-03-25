import type { DebugChannel } from "../debug/channel";
import type { PathMode } from "../types";
import type {
  DirectoryExtensionFilter,
  DirectoryRegexFilter,
} from "./filter";

export type ResolveBatchFilePathOptions = {
  pathMode: PathMode;
  recursive: boolean;
  extensionFilter?: DirectoryExtensionFilter;
  directoryRegexPattern?: string;
  debug?: DebugChannel;
};

export type PathResolveDebugStats = {
  dedupeAccepted: number;
  dedupeDuplicates: number;
  filterExcluded: number;
  regexExcluded: number;
  directoryIncluded: number;
};

export type ExpandDirectoryOptions = {
  rootPath: string;
  directoryPath: string;
  recursive: boolean;
  extensionFilter: DirectoryExtensionFilter;
  regexFilter: DirectoryRegexFilter;
};
