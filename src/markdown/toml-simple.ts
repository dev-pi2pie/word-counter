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

function parsePrimitive(raw: string): string | number | boolean | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
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

function normalizeValue(value: string): string | number | boolean | Array<string | number | boolean> | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return null;
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

export function parseTomlFrontmatter(frontmatter: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  const lines = frontmatter.split("\n");
  let tablePrefix = "";

  for (const rawLine of lines) {
    const withoutComment = stripInlineComment(rawLine).trim();
    if (!withoutComment) {
      continue;
    }

    if (/^\[\[/.test(withoutComment)) {
      return null;
    }

    const tableMatch = withoutComment.match(/^\[([^\]]+)]$/);
    if (tableMatch) {
      tablePrefix = tableMatch[1]?.trim() ?? "";
      continue;
    }

    const separatorIndex = withoutComment.indexOf("=");
    if (separatorIndex === -1) {
      return null;
    }

    const key = withoutComment.slice(0, separatorIndex).trim();
    const valueRaw = withoutComment.slice(separatorIndex + 1).trim();
    if (!key) {
      return null;
    }

    const normalized = normalizeValue(valueRaw);
    if (normalized === null) {
      return null;
    }

    const fullKey = tablePrefix ? `${tablePrefix}.${key}` : key;
    result[fullKey] = toPlainText(normalized);
  }

  return result;
}
