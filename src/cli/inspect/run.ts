import { applyConfigToInspectInvocation, resolveWordCounterConfig } from "../config";
import pc from "picocolors";
import { runInspectBatch } from "./batch";
import { printInspectHelp } from "./help";
import { loadInspectBatchInputs, loadSingleInspectInput, selectInspectText } from "./input";
import { validateInspectInvocation } from "./parse";
import { runSingleInspect } from "./single";
import type { ExecuteInspectCommandOptions } from "./types";

export function isExplicitInspectInvocation(argv: string[]): boolean {
  return argv[2] === "inspect";
}

function emitConfigNotes(notes: string[]): void {
  for (const note of notes) {
    const warningLine = note.startsWith("Warning:") ? note : `Warning: ${note}`;
    console.error(pc.yellow(warningLine));
  }
}

export async function executeInspectCommand({
  argv,
  runtime,
}: ExecuteInspectCommandOptions): Promise<void> {
  const parsed = validateInspectInvocation(argv);
  if (!parsed.ok) {
    console.error(pc.red(`error: ${parsed.message}`));
    process.exitCode = 1;
    return;
  }

  if (parsed.help) {
    printInspectHelp();
    process.exitCode = 0;
    return;
  }

  let validated = parsed;

  try {
    const resolvedConfig = await resolveWordCounterConfig({
      env: runtime?.env,
      cwd: runtime?.cwd,
    });
    validated = applyConfigToInspectInvocation(validated, resolvedConfig.config);
    emitConfigNotes(resolvedConfig.notes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`error: ${message}`));
    process.exitCode = 1;
    return;
  }

  if (validated.view === "engine" && validated.detector === "regex") {
    console.error(pc.red("error: `--view engine` requires `--detector wasm`."));
    process.exitCode = 1;
    return;
  }

  try {
    if (validated.paths.length === 0) {
      const input = await loadSingleInspectInput(
        undefined,
        validated.textTokens,
        validated.section,
      );
      await runSingleInspect(validated, input);
      return;
    }

    const loaded = await loadInspectBatchInputs(validated.paths, {
      pathMode: validated.pathMode,
      pathDetectBinary: validated.pathDetectBinary,
      recursive: validated.recursive,
      includeExt: validated.includeExt,
      excludeExt: validated.excludeExt,
      ...(validated.regex !== undefined ? { regex: validated.regex } : {}),
    });

    const directSinglePath =
      validated.paths.length === 1 &&
      loaded.files.length === 1 &&
      loaded.skipped.length === 0 &&
      loaded.failures.length === 0 &&
      loaded.files[0]?.source === "direct";

    if (directSinglePath) {
      const file = loaded.files[0];
      if (!file) {
        throw new Error("Missing inspect file input.");
      }
      await runSingleInspect(validated, {
        text: selectInspectText(file.text, validated.section),
        sourceType: "path",
        path: file.path,
      });
      return;
    }

    await runInspectBatch(validated, loaded);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`error: ${message}`));
    process.exitCode = 1;
  }
}
