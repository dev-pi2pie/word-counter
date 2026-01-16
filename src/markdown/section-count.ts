import type { WordCounterMode, WordCounterOptions, WordCounterResult } from "../wc/types";
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
  options: WordCounterOptions,
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
      result: wordCounter(text, options),
    };
  });
}

function buildSingleItem(
  name: string,
  text: string,
  mode: WordCounterMode,
  options: WordCounterOptions,
  source: "frontmatter" | "content",
) {
  return [{ name, source, result: wordCounter(text, options) }];
}

function sumTotals(items: Array<{ result: WordCounterResult }>): number {
  return items.reduce((sum, item) => sum + item.result.total, 0);
}

export function countSections(
  input: string,
  section: SectionMode,
  options: WordCounterOptions = {},
): SectionedResult {
  const mode: WordCounterMode = options.mode ?? "chunk";
  if (section === "all") {
    const result = wordCounter(input, options);
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
    items = buildSingleItem("frontmatter", frontmatterText, mode, options, "frontmatter");
  } else if (section === "content") {
    items = buildSingleItem("content", contentText, mode, options, "content");
  } else if (section === "split") {
    items = [
      ...buildSingleItem("frontmatter", frontmatterText, mode, options, "frontmatter"),
      ...buildSingleItem("content", contentText, mode, options, "content"),
    ];
  } else if (section === "per-key") {
    items = buildPerKeyItems(parsed.data, mode, options);
  } else if (section === "split-per-key") {
    items = [
      ...buildPerKeyItems(parsed.data, mode, options),
      ...buildSingleItem("content", contentText, mode, options, "content"),
    ];
  }

  return {
    section,
    total: sumTotals(items),
    frontmatterType: parsed.frontmatterType,
    items,
  };
}
