import { parseDocument } from "yaml";
import type { FrontmatterType, ParsedMarkdown } from "./types";

const FENCE_TO_TYPE: Record<string, FrontmatterType> = {
  "---": "yaml",
  "+++": "toml",
  ";;;": "json",
};

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n/g, "\n");
}

function stripBom(line: string): string {
  return line.startsWith("\uFEFF") ? line.slice(1) : line;
}

function getFenceType(line: string): FrontmatterType | null {
  const match = line.match(/^[\t ]*(---|\+\+\+|;;;)[\t ]*$/);
  if (!match) {
    return null;
  }
  return FENCE_TO_TYPE[match[1] ?? ""] ?? null;
}

function parseFrontmatter(frontmatter: string, type: FrontmatterType | null): Record<string, unknown> | null {
  if (!type) {
    return null;
  }

  if (type === "json") {
    try {
      return JSON.parse(frontmatter) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (type === "yaml") {
    const doc = parseDocument(frontmatter, { prettyErrors: false });
    if (doc.errors.length > 0) {
      return null;
    }
    const data = doc.toJSON();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }
    return data as Record<string, unknown>;
  }

  return null;
}

export function parseMarkdown(input: string): ParsedMarkdown {
  const normalized = normalizeNewlines(input);
  const lines = normalized.split("\n");
  if (lines.length === 0) {
    return { frontmatter: null, content: normalized, data: null, frontmatterType: null };
  }

  lines[0] = stripBom(lines[0] ?? "");

  const openingType = getFenceType(lines[0] ?? "");
  if (!openingType) {
    return { frontmatter: null, content: normalized, data: null, frontmatterType: null };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (getFenceType(lines[i] ?? "") === openingType) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return { frontmatter: null, content: normalized, data: null, frontmatterType: null };
  }

  const frontmatter = lines.slice(1, closingIndex).join("\n");
  const content = lines.slice(closingIndex + 1).join("\n");
  const data = parseFrontmatter(frontmatter, openingType);

  return {
    frontmatter,
    content,
    data,
    frontmatterType: openingType,
  };
}
