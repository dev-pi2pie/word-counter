import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requiredFiles = new Set([
  "dist/esm/index.mjs",
  "dist/esm/index.d.mts",
  "dist/cjs/index.cjs",
  "dist/esm/detector.mjs",
  "dist/esm/detector.d.mts",
  "dist/cjs/detector.cjs",
  "dist/wasm-language-detector/language_detector.js",
  "dist/wasm-language-detector/language_detector_bg.wasm",
]);

function normalizePackagePath(value) {
  return typeof value === "string" ? value.replace(/^\.\//u, "") : null;
}

function collectReferencedPackagePaths() {
  const packageJsonPath = process.env.npm_package_json ?? join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const referencedPaths = new Set();

  const maybeAdd = (value) => {
    const normalized = normalizePackagePath(value);
    if (normalized) {
      referencedPaths.add(normalized);
    }
  };

  maybeAdd(packageJson.main);
  maybeAdd(packageJson.module);
  maybeAdd(packageJson.types);

  const visitExports = (value) => {
    if (typeof value === "string") {
      maybeAdd(value);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const nested of Object.values(value)) {
      visitExports(nested);
    }
  };

  visitExports(packageJson.exports);
  return referencedPaths;
}

const tempCacheDir = mkdtempSync(join(tmpdir(), "word-counter-npm-cache-"));

const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    npm_config_cache: tempCacheDir,
  },
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "npm pack --dry-run failed.\n");
  process.exit(result.status ?? 1);
}

let payload;
try {
  payload = JSON.parse(result.stdout);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to parse npm pack --dry-run output: ${message}`);
  process.exit(1);
}

const files = Array.isArray(payload) && payload[0] && Array.isArray(payload[0].files)
  ? payload[0].files
  : [];

const presentPaths = new Set(
  files
    .map((file) => (typeof file?.path === "string" ? file.path : null))
    .filter((path) => typeof path === "string"),
);

const expectedPaths = new Set([...requiredFiles, ...collectReferencedPackagePaths()]);
const missingFiles = [...expectedPaths].filter((path) => !presentPaths.has(path));

if (missingFiles.length > 0) {
  console.error("Missing required package contents:");
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
  rmSync(tempCacheDir, { recursive: true, force: true });
  process.exit(1);
}

console.log("Package contents verified.");
rmSync(tempCacheDir, { recursive: true, force: true });
