import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { DetectorRouteTag } from "./policy";
import type { WhatlangWasmResult } from "./whatlang-map";

const GENERATED_FOLDER_NAME = "wasm-language-detector";
const GENERATED_MODULE_FILE = "language_detector.js";
const MAX_SEARCH_DEPTH = 8;
const requireFromHere = createRequire(import.meta.url);

export const WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE =
  "WASM detector runtime is unavailable. Run `bun run build:wasm` to generate it.";

type WhatlangWasmModule = {
  detect_language: (text: string, routeTag: string) => WhatlangWasmResult | null;
};

let modulePromise: Promise<WhatlangWasmModule> | null = null;

function resolveCandidateModulePaths(): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = new Set<string>();
  let currentDir = moduleDir;

  for (let depth = 0; depth < MAX_SEARCH_DEPTH; depth += 1) {
    candidates.add(join(currentDir, GENERATED_FOLDER_NAME, GENERATED_MODULE_FILE));
    candidates.add(join(currentDir, "generated", GENERATED_FOLDER_NAME, GENERATED_MODULE_FILE));

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return [...candidates];
}

function resolveWhatlangWasmModulePath(): string {
  for (const candidate of resolveCandidateModulePaths()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE);
}

async function loadWhatlangWasmModule(): Promise<WhatlangWasmModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const modulePath = resolveWhatlangWasmModulePath();
      return requireFromHere(modulePath) as WhatlangWasmModule;
    })();
  }

  return modulePromise;
}

export async function detectWithWhatlangWasm(
  text: string,
  routeTag: DetectorRouteTag,
): Promise<WhatlangWasmResult | null> {
  const wasmModule = await loadWhatlangWasmModule();
  return wasmModule.detect_language(text, routeTag);
}
