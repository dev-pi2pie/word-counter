import type { SectionedResult } from "../../markdown";
import { aggregateWordCounterResults } from "./aggregate-word-counter";

function buildSectionKey(name: string, source: "frontmatter" | "content"): string {
  return `${source}:${name}`;
}

export function aggregateSectionedResults(
  results: SectionedResult[],
  preserveCollectorSegments: boolean,
): SectionedResult {
  if (results.length === 0) {
    return {
      section: "all",
      total: 0,
      frontmatterType: null,
      items: [],
    };
  }

  const section = results[0]?.section ?? "all";
  const grouped = new Map<
    string,
    {
      name: string;
      source: "frontmatter" | "content";
      items: ReturnType<typeof aggregateWordCounterResults>[];
    }
  >();
  let total = 0;
  let frontmatterType = results[0]?.frontmatterType ?? null;

  for (const result of results) {
    total += result.total;

    if (result.section !== section) {
      throw new Error("Cannot aggregate section results with different section modes.");
    }

    if (frontmatterType !== result.frontmatterType) {
      frontmatterType = null;
    }

    for (const item of result.items) {
      const key = buildSectionKey(item.name, item.source);
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          name: item.name,
          source: item.source,
          items: [item.result],
        });
        continue;
      }

      existing.items.push(item.result);
    }
  }

  const sourceOrder = new Map<"frontmatter" | "content", number>([
    ["frontmatter", 0],
    ["content", 1],
  ]);

  const items = [...grouped.values()]
    .sort((left, right) => {
      const sourceDiff = (sourceOrder.get(left.source) ?? 0) - (sourceOrder.get(right.source) ?? 0);
      if (sourceDiff !== 0) {
        return sourceDiff;
      }
      return left.name.localeCompare(right.name);
    })
    .map((entry) => ({
      name: entry.name,
      source: entry.source,
      result: aggregateWordCounterResults(entry.items, preserveCollectorSegments),
    }));

  return {
    section,
    total,
    frontmatterType,
    items,
  };
}
