import { tokenizeTomlConfig } from "./toml-tokens";

type TomlPrimitive = string | boolean;
type TomlValue = TomlPrimitive | TomlPrimitive[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTomlString(rawValue: string): string {
  if (rawValue.length < 2) {
    throw new Error(`Invalid TOML string value: ${rawValue}`);
  }

  const quote = rawValue[0];
  const inner = rawValue.slice(1, -1);
  if (quote === "'") {
    return inner;
  }

  return inner.replace(/\\(["\\bfnrt])/g, (_match, escaped: string) => {
    switch (escaped) {
      case '"':
        return '"';
      case "\\":
        return "\\";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return escaped;
    }
  });
}

function splitTomlArrayItems(rawValue: string): string[] {
  const items: string[] = [];
  let buffer = "";
  let inSingle = false;
  let inDouble = false;

  for (let index = 0; index < rawValue.length; index += 1) {
    const current = rawValue[index] ?? "";
    const previous = rawValue[index - 1] ?? "";

    if (current === "'" && !inDouble) {
      inSingle = !inSingle;
      buffer += current;
      continue;
    }

    if (current === '"' && !inSingle && previous !== "\\") {
      inDouble = !inDouble;
      buffer += current;
      continue;
    }

    if (current === "," && !inSingle && !inDouble) {
      items.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += current;
  }

  if (buffer.trim().length > 0) {
    items.push(buffer.trim());
  }

  return items;
}

function parseTomlValue(rawValue: string): TomlValue {
  const trimmed = rawValue.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return parseTomlString(trimmed);
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.length === 0) {
      return [];
    }
    return splitTomlArrayItems(inner).map((item) => {
      const parsed = parseTomlValue(item);
      if (Array.isArray(parsed)) {
        throw new Error(`Nested TOML arrays are not supported: ${rawValue}`);
      }
      return parsed;
    });
  }

  throw new Error(`Unsupported TOML value: ${rawValue}`);
}

function ensureObject(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = parent[key];
  if (existing === undefined) {
    const next: Record<string, unknown> = {};
    parent[key] = next;
    return next;
  }

  if (!isRecord(existing)) {
    throw new Error(`Cannot redefine non-table key as table: ${key}`);
  }

  return existing;
}

function setNestedValue(root: Record<string, unknown>, keyPath: string[], value: TomlValue): void {
  let target = root;
  for (let index = 0; index < keyPath.length - 1; index += 1) {
    target = ensureObject(target, keyPath[index] ?? "");
  }

  const leafKey = keyPath[keyPath.length - 1] ?? "";
  if (leafKey in target) {
    throw new Error(`Duplicate TOML key: ${keyPath.join(".")}`);
  }
  target[leafKey] = value;
}

export function parseTomlConfig(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const token of tokenizeTomlConfig(text)) {
    if (token.kind === "table") {
      let tableTarget = result;
      for (const part of token.path) {
        tableTarget = ensureObject(tableTarget, part);
      }
      continue;
    }

    setNestedValue(result, token.keyPath, parseTomlValue(token.rawValue));
  }

  return result;
}
