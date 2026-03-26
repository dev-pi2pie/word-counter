import { readFile } from "node:fs/promises";
import { ConfigParseError, ConfigValidationError } from "./errors";
import { stripJsonComments } from "./jsonc";
import { normalizeWordCounterConfig } from "./normalize";
import { parseTomlConfig } from "./toml";
import type { ConfigFormat, ParsedConfigFile, WordCounterConfig } from "./types";

function parseJsonConfig(text: string, sourceLabel: string, format: "json" | "jsonc"): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigParseError(sourceLabel, format, message);
  }
}

export function parseConfigText(
  text: string,
  format: ConfigFormat,
  sourceLabel: string,
): WordCounterConfig {
  let parsed: unknown;

  if (format === "json") {
    parsed = parseJsonConfig(text, sourceLabel, "json");
  } else if (format === "jsonc") {
    try {
      parsed = parseJsonConfig(stripJsonComments(text), sourceLabel, "jsonc");
    } catch (error) {
      if (error instanceof ConfigParseError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ConfigParseError(sourceLabel, "jsonc", message);
    }
  } else {
    try {
      parsed = parseTomlConfig(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ConfigParseError(sourceLabel, "toml", message);
    }
  }

  try {
    return normalizeWordCounterConfig(parsed, sourceLabel);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigParseError(sourceLabel, format, message);
  }
}

export async function loadConfigFile(
  path: string,
  format: ConfigFormat,
): Promise<ParsedConfigFile> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config file (${path}): ${message}`);
  }

  return {
    format,
    path,
    config: parseConfigText(text, format, path),
  };
}
