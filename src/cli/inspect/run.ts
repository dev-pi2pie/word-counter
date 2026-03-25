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

export async function executeInspectCommand({ argv }: ExecuteInspectCommandOptions): Promise<void> {
  const validated = validateInspectInvocation(argv);
  if (!validated.ok) {
    console.error(pc.red(`error: ${validated.message}`));
    process.exitCode = 1;
    return;
  }

  if (validated.help) {
    printInspectHelp();
    process.exitCode = 0;
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
