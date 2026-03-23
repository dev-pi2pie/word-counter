import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const runtimeCandidates = [
  join(repoRoot, "generated", "wasm-language-detector", "language_detector.js"),
  join(repoRoot, "dist", "wasm-language-detector", "language_detector.js"),
];

export function hasWasmDetectorRuntime(): boolean {
  return runtimeCandidates.some((candidate) => existsSync(candidate));
}
