import { cp, mkdir, rm } from "node:fs/promises";
import { accessSync, constants as fsConstants, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const crateDir = join(repoRoot, "crates", "language-detector");
const generatedDir = join(repoRoot, "generated", "wasm-language-detector");
const distRuntimeDir = join(repoRoot, "dist", "wasm-language-detector");

function runCommand(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

function assertCommandAvailable(command) {
  const pathValue = process.env.PATH ?? "";
  const segments = pathValue.split(":").filter((segment) => segment.length > 0);
  for (const segment of segments) {
    const candidate = join(segment, command);
    if (!existsSync(candidate)) {
      continue;
    }
    try {
      accessSync(candidate, fsConstants.X_OK);
      return;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Missing required command: ${command}. Install the Rust/WASM toolchain before running this build.`,
  );
}

async function copyRuntimeArtifacts() {
  await rm(distRuntimeDir, { recursive: true, force: true });
  await mkdir(join(repoRoot, "dist"), { recursive: true });
  await cp(generatedDir, distRuntimeDir, { recursive: true });
  await rm(join(distRuntimeDir, ".gitignore"), { force: true });
}

async function main() {
  assertCommandAvailable("cargo");
  assertCommandAvailable("wasm-pack");

  await rm(generatedDir, { recursive: true, force: true });
  await mkdir(join(repoRoot, "generated"), { recursive: true });

  await runCommand(
    "wasm-pack",
    [
      "build",
      "--target",
      "nodejs",
      "--release",
      "--out-dir",
      "../../generated/wasm-language-detector",
      "--out-name",
      "language_detector",
    ],
    crateDir,
  );

  await copyRuntimeArtifacts();
}

await main();
