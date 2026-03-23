import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requiredFiles = new Set([
  "dist/esm/index.mjs",
  "dist/cjs/index.cjs",
  "dist/esm/detector.mjs",
  "dist/cjs/detector.cjs",
  "dist/wasm-language-detector/language_detector.js",
  "dist/wasm-language-detector/language_detector_bg.wasm",
]);

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

const missingFiles = [...requiredFiles].filter((path) => !presentPaths.has(path));

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
