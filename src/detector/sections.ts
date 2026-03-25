import { parseMarkdown } from "../markdown";
import type { SectionMode, SectionedResult } from "../markdown";
import type { WordCounterResult } from "../wc/types";
import type { DetectorCountSectionsOptions } from "./types";
import { wordCounterWithDetector } from "./index";

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

async function buildPerKeyItems(
  data: Record<string, unknown> | null,
  options: DetectorCountSectionsOptions,
): Promise<Array<{ name: string; source: "frontmatter"; result: WordCounterResult }>> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Promise.all(
    Object.entries(data).map(async ([key, value]) => {
      const valueText = normalizeText(value);
      const text = valueText ? `${key}: ${valueText}` : key;
      return {
        name: key,
        source: "frontmatter" as const,
        result: await wordCounterWithDetector(text, options),
      };
    }),
  );
}

async function buildSingleItem(
  name: string,
  text: string,
  options: DetectorCountSectionsOptions,
  source: "frontmatter" | "content",
): Promise<Array<{ name: string; source: "frontmatter" | "content"; result: WordCounterResult }>> {
  return [{ name, source, result: await wordCounterWithDetector(text, options) }];
}

function sumTotals(items: Array<{ result: WordCounterResult }>): number {
  return items.reduce((sum, item) => sum + item.result.total, 0);
}

export async function countSectionsWithResolvedDetector(
  input: string,
  section: SectionMode,
  options: DetectorCountSectionsOptions = {},
): Promise<SectionedResult> {
  if (section === "all") {
    const result = await wordCounterWithDetector(input, options);
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

  let items: Array<{ name: string; source: "frontmatter" | "content"; result: WordCounterResult }> =
    [];

  if (section === "frontmatter") {
    items = await buildSingleItem("frontmatter", frontmatterText, options, "frontmatter");
  } else if (section === "content") {
    items = await buildSingleItem("content", contentText, options, "content");
  } else if (section === "split") {
    items = [
      ...(await buildSingleItem("frontmatter", frontmatterText, options, "frontmatter")),
      ...(await buildSingleItem("content", contentText, options, "content")),
    ];
  } else if (section === "per-key") {
    items = await buildPerKeyItems(parsed.data, options);
  } else if (section === "split-per-key") {
    items = [
      ...(await buildPerKeyItems(parsed.data, options)),
      ...(await buildSingleItem("content", contentText, options, "content")),
    ];
  }

  return {
    section,
    total: sumTotals(items),
    frontmatterType: parsed.frontmatterType,
    items,
  };
}
