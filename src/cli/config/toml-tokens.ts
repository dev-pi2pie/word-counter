export type TomlLineToken =
  | {
      kind: "table";
      path: string[];
      rawLine: string;
    }
  | {
      kind: "assignment";
      keyPath: string[];
      rawValue: string;
      rawLine: string;
    };

function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;

  for (let index = 0; index < line.length; index += 1) {
    const current = line[index] ?? "";
    const previous = line[index - 1] ?? "";

    if (current === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (current === '"' && !inSingle && previous !== "\\") {
      inDouble = !inDouble;
      continue;
    }

    if (current === "#" && !inSingle && !inDouble) {
      return line.slice(0, index);
    }
  }

  return line;
}

function splitPath(path: string, rawLine: string): string[] {
  const parts = path.split(".").map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) {
    throw new Error(`Invalid TOML key: ${rawLine}`);
  }
  return parts;
}

function tokenizeTomlLine(rawLine: string, currentTable: string[]): TomlLineToken | undefined {
  const line = stripInlineComment(rawLine).trim();
  if (!line) {
    return undefined;
  }

  const tableMatch = line.match(/^\[([A-Za-z0-9_.-]+)]$/);
  if (tableMatch) {
    return {
      kind: "table",
      path: splitPath(tableMatch[1] ?? "", rawLine),
      rawLine,
    };
  }

  const separatorIndex = line.indexOf("=");
  if (separatorIndex <= 0) {
    throw new Error(`Invalid TOML assignment: ${rawLine}`);
  }

  const rawKey = line.slice(0, separatorIndex).trim();
  const rawValue = line.slice(separatorIndex + 1).trim();
  if (!rawKey || !rawValue) {
    throw new Error(`Invalid TOML assignment: ${rawLine}`);
  }

  return {
    kind: "assignment",
    keyPath: [...currentTable, ...splitPath(rawKey, rawLine)],
    rawValue,
    rawLine,
  };
}

export function tokenizeTomlConfig(text: string): TomlLineToken[] {
  const tokens: TomlLineToken[] = [];
  let currentTable: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const token = tokenizeTomlLine(rawLine, currentTable);
    if (!token) {
      continue;
    }

    if (token.kind === "table") {
      currentTable = token.path;
      tokens.push(token);
      continue;
    }

    tokens.push(token);
  }

  return tokens;
}
