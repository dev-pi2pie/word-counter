import type { WordCounterConfig } from "./types";

function mergeSection<T extends Record<string, unknown> | undefined>(
  base: T,
  override: T,
): T | undefined {
  if (!base) {
    return override ? ({ ...override } as T) : undefined;
  }
  if (!override) {
    return { ...base } as T;
  }
  return { ...base, ...override } as T;
}

function mergeNestedSection<T extends Record<string, unknown> | undefined>(
  base: T,
  override: T,
  nestedKey: string,
): T | undefined {
  const merged = mergeSection(base, override);
  if (!merged) {
    return undefined;
  }

  const baseRecord = base as Record<string, unknown> | undefined;
  const overrideRecord = override as Record<string, unknown> | undefined;
  const baseNested = baseRecord?.[nestedKey];
  const overrideNested = overrideRecord?.[nestedKey];
  if (
    typeof baseNested === "object" &&
    baseNested !== null &&
    typeof overrideNested === "object" &&
    overrideNested !== null
  ) {
    return {
      ...merged,
      [nestedKey]: {
        ...(baseNested as Record<string, unknown>),
        ...(overrideNested as Record<string, unknown>),
      },
    } as T;
  }

  return merged;
}

export function mergeWordCounterConfig(
  base: WordCounterConfig,
  override: WordCounterConfig,
): WordCounterConfig {
  return {
    ...base,
    ...override,
    ...(base.inspect || override.inspect
      ? {
          inspect: mergeSection(base.inspect, override.inspect),
        }
      : {}),
    ...(base.path || override.path
      ? {
          path: mergeSection(base.path, override.path),
        }
      : {}),
    ...(base.progress || override.progress
      ? {
          progress: mergeSection(base.progress, override.progress),
        }
      : {}),
    ...(base.output || override.output
      ? {
          output: mergeSection(base.output, override.output),
        }
      : {}),
    ...(base.reporting || override.reporting
      ? {
          reporting: mergeNestedSection(base.reporting, override.reporting, "debugReport"),
        }
      : {}),
    ...(base.logging || override.logging
      ? {
          logging: mergeSection(base.logging, override.logging),
        }
      : {}),
  };
}
