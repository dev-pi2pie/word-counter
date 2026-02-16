import { Command } from "commander";
import { createDebugChannel } from "./cli/debug/channel";
import { configureProgramOptions } from "./cli/program/options";
import { getFormattedVersionLabel } from "./cli/program/version";
import { executeBatchCount } from "./cli/runtime/batch";
import {
  hasPathInput,
  resolveCountRunOptions,
  resolveDebugReportPathOption,
} from "./cli/runtime/options";
import { executeSingleCount } from "./cli/runtime/single";
import type { CliActionOptions, RunCliOptions } from "./cli/runtime/types";
import type { WordCounterMode } from "./wc";
import { normalizeMode } from "./wc/mode";
import pc from "picocolors";

export async function runCli(
  argv: string[] = process.argv,
  runtime: RunCliOptions = {},
): Promise<void> {
  const program = new Command();
  const parseMode = (value: string): WordCounterMode => {
    const normalized = normalizeMode(value);
    if (!normalized) {
      throw new Error(`Invalid mode: ${value}`);
    }
    return normalized;
  };

  program
    .name("word-counter")
    .description("Locale-aware word counting powered by Intl.Segmenter.")
    .version(getFormattedVersionLabel(), "-v, --version", "output the version number");
  configureProgramOptions(program, parseMode);

  program.action(
    async (textTokens: string[], options: CliActionOptions) => {
      const debugEnabled = Boolean(options.debug);
      const debugReportPath = resolveDebugReportPathOption(options.debugReport);
      const debugReportEnabled = options.debugReport !== undefined && options.debugReport !== false;

      if (options.verbose && !debugEnabled) {
        program.error(pc.red("`--verbose` requires `--debug`."));
        return;
      }

      if (debugReportEnabled && !debugEnabled) {
        program.error(pc.red("`--debug-report` requires `--debug`."));
        return;
      }

      const teeEnabled = Boolean(options.debugReportTee || options.debugTee);

      if (teeEnabled && !debugReportEnabled) {
        program.error(
          pc.red("`--debug-report-tee` (alias: `--debug-tee`) requires `--debug-report`."),
        );
        return;
      }

      let debug;
      try {
        debug = createDebugChannel({
          enabled: debugEnabled,
          verbosity: options.verbose ? "verbose" : "compact",
          report: debugReportEnabled
            ? {
                path: debugReportPath,
                tee: teeEnabled,
              }
            : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        program.error(pc.red(`Failed to initialize debug diagnostics: ${message}`));
        return;
      }

      try {
        const resolved = resolveCountRunOptions(options);
        if (hasPathInput(options.path)) {
          await executeBatchCount({
            argv,
            options,
            runtime,
            resolved,
            debug,
            teeEnabled,
          });
          return;
        }

        await executeSingleCount({
          textTokens,
          options,
          resolved,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "No input provided. Pass text, pipe stdin, or use --path.") {
          program.error(pc.red(message));
          return;
        }
        if (message === "No readable text-like inputs were found from --path.") {
          program.error(pc.red(message));
          return;
        }
        program.error(message);
      } finally {
        await debug.close();
      }
    },
  );

  await program.parseAsync(argv);
}

export { buildBatchSummary } from "./cli/batch/aggregate";
export { loadBatchInputs } from "./cli/path/load";
export { resolveBatchFilePaths } from "./cli/path/resolve";
