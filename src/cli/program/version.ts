import { readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

function* candidateSearchRoots(): Generator<string> {
  yield dirname(fileURLToPath(import.meta.url));

  const argvPath = process.argv[1];
  if (typeof argvPath === "string" && argvPath.length > 0) {
    yield dirname(resolvePath(argvPath));
  }

  yield process.cwd();
}

function* walkUpDirectories(start: string, maxLevels: number): Generator<string> {
  let current = start;
  for (let depth = 0; depth < maxLevels; depth += 1) {
    yield current;
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
}

function resolveVersionFromPath(start: string, maxLevels: number): string | null {
  for (const directory of walkUpDirectories(start, maxLevels)) {
    try {
      const raw = readFileSync(join(directory, "package.json"), "utf8");
      const data = JSON.parse(raw) as { version?: string };
      if (data.version) {
        return data.version;
      }
    } catch {
      // Try parent directories.
    }
  }
  return null;
}

function resolvePackageVersion(): string {
  const maxLevels = 8;

  const seen = new Set<string>();
  for (const root of candidateSearchRoots()) {
    if (seen.has(root)) {
      continue;
    }
    seen.add(root);
    const version = resolveVersionFromPath(root, maxLevels);
    if (version) {
      return version;
    }
  }

  return "0.0.0";
}

export function getFormattedVersionLabel(): string {
  const version = resolvePackageVersion();

  return pc.bgBlack(pc.bold(pc.italic(` word-counter ${pc.cyanBright(`ver.${version}`)} `)));
}
