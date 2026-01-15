function stripInlineComment(line: string): string {
  let inString: 'single' | 'double' | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? "";

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\" && inString === "double") {
        escaped = true;
        continue;
      }

      if (inString === "double" && char === '"') {
        inString = null;
        continue;
      }

      if (inString === "single" && char === "'") {
        inString = null;
        continue;
      }

      continue;
    }

    if (char === '"') {
      inString = "double";
      continue;
    }

    if (char === "'") {
      inString = "single";
      continue;
    }

    if (char === "#") {
      return line.slice(0, i).trimEnd();
    }
  }

  return line;
}

function stripKeyQuotes(key: string): string {
  const trimmed = key.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeKeyPath(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }

  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const unquoted = stripKeyQuotes(trimmed);
    return unquoted ? unquoted : null;
  }

  const segments = trimmed.split(".").map((segment) => segment.trim());
  if (segments.some((segment) => !segment)) {
    return null;
  }
  return segments.join(".");
}

function unescapeBasic(input: string): string {
  return input
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

function parseStringLiteral(value: string): string | null {
  if (value.startsWith('"""') && value.endsWith('"""')) {
    const inner = value.slice(3, -3);
    return unescapeBasic(inner);
  }

  if (value.startsWith("'''") && value.endsWith("'''")) {
    return value.slice(3, -3);
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return unescapeBasic(value.slice(1, -1));
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return null;
}

function parsePrimitive(raw: string): string | number | boolean | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const stringLiteral = parseStringLiteral(value);
  if (stringLiteral !== null) {
    return stringLiteral;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    return Number(value);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }

  return value;
}

function parseArray(raw: string): Array<string | number | boolean> | null {
  const value = raw.trim();
  if (!value.startsWith("[") || !value.endsWith("]")) {
    return null;
  }

  const inner = value.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const items: Array<string | number | boolean> = [];
  let current = "";
  let inString: 'single' | 'double' | null = null;
  let escaped = false;

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i] ?? "";

    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\" && inString === "double") {
        escaped = true;
        continue;
      }

      if (inString === "double" && char === '"') {
        inString = null;
      } else if (inString === "single" && char === "'") {
        inString = null;
      }
      continue;
    }

    if (char === '"') {
      inString = "double";
      current += char;
      continue;
    }

    if (char === "'") {
      inString = "single";
      current += char;
      continue;
    }

    if (char === ",") {
      const item = parsePrimitive(current);
      if (item === null) {
        return null;
      }
      items.push(item);
      current = "";
      continue;
    }

    current += char;
  }

  const finalItem = parsePrimitive(current);
  if (finalItem === null) {
    return null;
  }
  items.push(finalItem);

  return items;
}

type TomlValue = string | number | boolean | Array<string | number | boolean> | Record<string, unknown>;

function parseInlineTable(raw: string): Record<string, TomlValue> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return {};
  }

  const pairs: string[] = [];
  let current = "";
  let inString: "single" | "double" | null = null;
  let escaped = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i] ?? "";

    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\" && inString === "double") {
        escaped = true;
        continue;
      }

      if (inString === "double" && char === "\"") {
        inString = null;
      } else if (inString === "single" && char === "'") {
        inString = null;
      }
      continue;
    }

    if (char === "\"") {
      inString = "double";
      current += char;
      continue;
    }

    if (char === "'") {
      inString = "single";
      current += char;
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      current += char;
      continue;
    }

    if (char === "]") {
      if (bracketDepth > 0) {
        bracketDepth -= 1;
      }
      current += char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      current += char;
      continue;
    }

    if (char === "}") {
      if (braceDepth > 0) {
        braceDepth -= 1;
      }
      current += char;
      continue;
    }

    if (char === "," && bracketDepth === 0 && braceDepth === 0) {
      pairs.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    pairs.push(current);
  }

  const output: Record<string, TomlValue> = {};
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return null;
    }
    const key = normalizeKeyPath(pair.slice(0, separatorIndex));
    if (!key) {
      return null;
    }
    const valueRaw = pair.slice(separatorIndex + 1).trim();
    if (!valueRaw) {
      return null;
    }
    if (valueRaw.startsWith("{")) {
      return null;
    }
    const normalized = normalizeValue(valueRaw);
    if (normalized === null) {
      return null;
    }
    if (typeof normalized === "object" && !Array.isArray(normalized)) {
      return null;
    }
    output[key] = normalized;
  }

  return output;
}

function normalizeValue(value: string): TomlValue | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseInlineTable(trimmed);
  }

  const array = parseArray(trimmed);
  if (array) {
    return array;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return null;
  }

  return parsePrimitive(trimmed);
}

function toPlainText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  return String(value);
}

function ensureArrayContainer(result: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const existing = result[key];
  if (Array.isArray(existing)) {
    return existing as Record<string, unknown>[];
  }
  const list: Record<string, unknown>[] = [];
  result[key] = list;
  return list;
}

export function parseTomlFrontmatter(frontmatter: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  const lines = frontmatter.split("\n");
  let tablePrefix = "";
  let tableTarget: Record<string, unknown> | null = null;
  let tablePrefixInList = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    if (trimmedLine.startsWith('[[')) {
      const match = trimmedLine.match(/^\[\[([^\]]+)]]$/);
      if (!match) {
        return null;
      }
      const normalizedTable = normalizeKeyPath(match[1] ?? "");
      if (!normalizedTable) {
        return null;
      }
      const list = ensureArrayContainer(result, normalizedTable);
      const newEntry: Record<string, unknown> = {};
      list.push(newEntry);
      tableTarget = newEntry;
      tablePrefix = normalizedTable;
      tablePrefixInList = true;
      continue;
    }

    const tableMatch = trimmedLine.match(/^\[([^\]]+)]$/);
    if (tableMatch) {
      const normalizedTable = normalizeKeyPath(tableMatch[1] ?? "");
      if (!normalizedTable) {
        return null;
      }
      tablePrefix = normalizedTable;
      tablePrefixInList = false;
      tableTarget = null;
      continue;
    }

    const lineForParsing = /("""|''')/.test(rawLine) ? rawLine : stripInlineComment(rawLine);
    const separatorIndex = lineForParsing.indexOf("=");
    if (separatorIndex === -1) {
      return null;
    }

    const keyRaw = lineForParsing.slice(0, separatorIndex);
    const key = normalizeKeyPath(keyRaw);
    let valueRaw = lineForParsing.slice(separatorIndex + 1).trim();
    if (!key) {
      return null;
    }

    if (
      (valueRaw.startsWith('"""') && !/"""\s*$/.test(valueRaw)) ||
      (valueRaw.startsWith("'''") && !/'''\s*$/.test(valueRaw))
    ) {
      const delimiter = valueRaw.startsWith('"""') ? '"""' : "'''";
      let combined = valueRaw;
      let closed = false;
      while (index + 1 < lines.length) {
        index += 1;
        const nextLine = lines[index] ?? "";
        combined += `\n${nextLine}`;
        if (new RegExp(`${delimiter}\\s*$`).test(nextLine)) {
          closed = true;
          break;
        }
      }
      if (!closed) {
        return null;
      }
      valueRaw = combined;
    }

    const normalized = normalizeValue(valueRaw);
    if (normalized === null) {
      return null;
    }

    const fullKey = tablePrefix ? `${tablePrefix}.${key}` : key;
    if (typeof normalized === "object" && !Array.isArray(normalized)) {
      for (const [inlineKey, inlineValue] of Object.entries(normalized)) {
        const entryKey = tablePrefixInList ? `${key}.${inlineKey}` : `${fullKey}.${inlineKey}`;
        if (tablePrefixInList && tableTarget) {
          tableTarget[entryKey] = toPlainText(inlineValue);
        } else {
          result[entryKey] = toPlainText(inlineValue);
        }
      }
      continue;
    }

    if (tablePrefixInList && tableTarget) {
      tableTarget[key] = toPlainText(normalized);
      continue;
    }

    result[fullKey] = toPlainText(normalized);
  }

  for (const [key, value] of Object.entries(result)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const flattened = value
      .map((entry) =>
        Object.entries(entry)
          .map(([entryKey, entryValue]) => `${entryKey}=${entryValue}`)
          .join(", "),
      )
      .join(" | ");
    result[key] = flattened;
  }

  return result;
}
