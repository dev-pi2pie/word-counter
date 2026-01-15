import type { WordCounterMode, WordCounterResult } from "../wc/types";
import wordCounter from "../wc";
import { parseMarkdown } from "./parse-markdown";
import type { SectionMode, SectionedResult } from "./types";

function normalizeText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildPerKeyItems(
  data: Record<string, unknown> | null,
  mode: WordCounterMode,
): Array<{ name: string; source: "frontmatter"; result: WordCounterResult }> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data).map(([key, value]) => {
    const valueText = normalizeText(value);
    const text = valueText ? `${key}: ${valueText}` : key;
    return {
      name: key,
      source: "frontmatter",
      result: wordCounter(text, { mode }),
    };
  });
}

function buildSingleItem(
  name: string,
  text: string,
  mode: WordCounterMode,
  source: "frontmatter" | "content",
) {
  return [{ name, source, result: wordCounter(text, { mode }) }];
}

function sumTotals(items: Array<{ result: WordCounterResult }>): number {
  return items.reduce((sum, item) => sum + item.result.total, 0);
}

export function countSections(
  input: string,
  section: SectionMode,
  mode: WordCounterMode,
): SectionedResult {
  if (section === "all") {
    const result = wordCounter(input, { mode });
    return {
      section,
      total: result.total,
      frontmatterType: null,
      items: [{ name: "all", source: "content", result }],
    };
  }

  const parsed = parseMarkdown(input);
  const frontmatterText = parsed.frontmatter ?? "";
  const contentText = parsed.content ?? "";

  let items: Array<{ name: string; source: "frontmatter" | "content"; result: WordCounterResult }> = [];

  if (section === "frontmatter") {
    items = buildSingleItem("frontmatter", frontmatterText, mode, "frontmatter");
  } else if (section === "content") {
    items = buildSingleItem("content", contentText, mode, "content");
  } else if (section === "split") {
    items = [
      ...buildSingleItem("frontmatter", frontmatterText, mode, "frontmatter"),
      ...buildSingleItem("content", contentText, mode, "content"),
    ];
  } else if (section === "per-key") {
    items = buildPerKeyItems(parsed.data, mode);
  } else if (section === "split-per-key") {
    items = [
      ...buildPerKeyItems(parsed.data, mode),
      ...buildSingleItem("content", contentText, mode, "content"),
    ];
  }

  return {
    section,
    total: sumTotals(items),
    frontmatterType: parsed.frontmatterType,
    items,
  };
}
