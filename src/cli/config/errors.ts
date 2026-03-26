import type { ConfigFormat } from "./types";

export class ConfigValidationError extends Error {
  readonly sourceLabel: string;
  readonly path: string[];

  constructor(sourceLabel: string, path: string[], message: string) {
    const suffix = path.length > 0 ? ` at "${path.join(".")}"` : "";
    super(`Invalid config in ${sourceLabel}${suffix}: ${message}`);
    this.name = "ConfigValidationError";
    this.sourceLabel = sourceLabel;
    this.path = [...path];
  }
}

export class ConfigParseError extends Error {
  readonly sourceLabel: string;
  readonly format: ConfigFormat;

  constructor(sourceLabel: string, format: ConfigFormat, message: string) {
    super(`Invalid ${format.toUpperCase()} config in ${sourceLabel}: ${message}`);
    this.name = "ConfigParseError";
    this.sourceLabel = sourceLabel;
    this.format = format;
  }
}
