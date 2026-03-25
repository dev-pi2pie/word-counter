import type { DebugChannel } from "../debug/channel";
import type { PathResolveDebugStats } from "./resolve-types";

const NOOP_DEBUG_CHANNEL = {
  enabled: false,
  verbosity: "compact",
  emit() {
    return;
  },
  close: async () => {
    return;
  },
} satisfies DebugChannel;

export function resolvePathDebugChannel(debug?: DebugChannel): DebugChannel {
  return debug ?? NOOP_DEBUG_CHANNEL;
}

export function createPathResolveDebugStats(): PathResolveDebugStats {
  return {
    dedupeAccepted: 0,
    dedupeDuplicates: 0,
    filterExcluded: 0,
    regexExcluded: 0,
    directoryIncluded: 0,
  };
}

export function emitPathResolveSummaries(
  debug: DebugChannel,
  stats: PathResolveDebugStats,
  files: number,
  skipped: number,
): void {
  debug.emit("path.resolve.filter.summary", {
    excluded: stats.filterExcluded + stats.regexExcluded,
    extensionExcluded: stats.filterExcluded,
    regexExcluded: stats.regexExcluded,
    included: stats.directoryIncluded,
  });
  debug.emit("path.resolve.dedupe.summary", {
    accepted: stats.dedupeAccepted,
    duplicates: stats.dedupeDuplicates,
  });
  debug.emit("path.resolve.complete", {
    files,
    skipped,
    ordering: "absolute-path-ascending",
  });
}
