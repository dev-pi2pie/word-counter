import { extname, relative, sep } from "node:path";

export type DirectoryExtensionFilter = {
  includeExtensions: Set<string>;
  excludeExtensions: Set<string>;
  effectiveIncludeExtensions: Set<string>;
};

export type DirectoryRegexFilter = {
  sourcePattern: string | undefined;
  regex: RegExp | undefined;
};

export const DEFAULT_INCLUDE_EXTENSIONS = Object.freeze([
  ".md",
  ".markdown",
  ".mdx",
  ".mdc",
  ".txt",
]);

export function collectExtensionOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function normalizeExtensionToken(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
  if (normalized === ".") {
    return null;
  }

  return normalized;
}

function parseExtensionValues(values: string[] | undefined): Set<string> {
  const parsed = new Set<string>();
  if (!values || values.length === 0) {
    return parsed;
  }

  for (const value of values) {
    for (const token of value.split(",")) {
      const normalized = normalizeExtensionToken(token);
      if (!normalized) {
        continue;
      }
      parsed.add(normalized);
    }
  }

  return parsed;
}

export function buildDirectoryExtensionFilter(
  includeValues: string[] | undefined,
  excludeValues: string[] | undefined,
): DirectoryExtensionFilter {
  const includeFromFlags = parseExtensionValues(includeValues);
  const excludeExtensions = parseExtensionValues(excludeValues);

  const includeExtensions =
    includeFromFlags.size > 0 ? includeFromFlags : new Set(DEFAULT_INCLUDE_EXTENSIONS);

  const effectiveIncludeExtensions = new Set<string>();
  for (const extension of includeExtensions) {
    if (excludeExtensions.has(extension)) {
      continue;
    }
    effectiveIncludeExtensions.add(extension);
  }

  return {
    includeExtensions,
    excludeExtensions,
    effectiveIncludeExtensions,
  };
}

export function shouldIncludeFromDirectory(
  filePath: string,
  filter: DirectoryExtensionFilter,
): boolean {
  const extension = extname(filePath).toLowerCase();
  return filter.effectiveIncludeExtensions.has(extension);
}

export function buildDirectoryRegexFilter(pattern: string | undefined): DirectoryRegexFilter {
  if (pattern === undefined) {
    return { sourcePattern: undefined, regex: undefined };
  }

  if (pattern.trim().length === 0) {
    return { sourcePattern: pattern, regex: undefined };
  }

  try {
    return { sourcePattern: pattern, regex: new RegExp(pattern) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid --regex pattern: ${message}`);
  }
}

export function toDirectoryRelativePath(rootPath: string, filePath: string): string {
  const relativePath = relative(rootPath, filePath);
  if (sep === "/") {
    return relativePath;
  }
  return relativePath.split(sep).join("/");
}

export function shouldIncludeFromDirectoryRegex(
  relativePath: string,
  filter: DirectoryRegexFilter,
): boolean {
  if (!filter.regex) {
    return true;
  }

  return filter.regex.test(relativePath);
}
