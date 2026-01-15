import { describe, expect, test } from "bun:test";
import { parseMarkdown, countSections } from "../src/markdown";

const YAML_SAMPLE = [
  "---",
  "title: Hello world",
  "summary: Short note",
  "---",
  "Body text",
].join("\n");

describe("parseMarkdown", () => {
  test("parses YAML frontmatter", () => {
    const result = parseMarkdown(YAML_SAMPLE);
    expect(result.frontmatterType).toBe("yaml");
    expect(result.frontmatter).toBe("title: Hello world\nsummary: Short note");
    expect(result.content).toBe("Body text");
    expect(result.data?.title).toBe("Hello world");
  });

  test("parses JSON frontmatter", () => {
    const input = [";;;", '{"title":"Hello"}', ";;;", "Body"].join("\n");
    const result = parseMarkdown(input);
    expect(result.frontmatterType).toBe("json");
    expect(result.data?.title).toBe("Hello");
  });

  test("parses JSON frontmatter with braces", () => {
    const input = ['{"title":"Hello","summary":"Note"}', "Body"].join("\n");
    const result = parseMarkdown(input);
    expect(result.frontmatterType).toBe("json");
    expect(result.frontmatter).toBe('{"title":"Hello","summary":"Note"}');
    expect(result.data?.summary).toBe("Note");
  });

  test("detects TOML fences", () => {
    const input = ["+++", "title = \"Hello\"", "+++", "Body"].join("\n");
    const result = parseMarkdown(input);
    expect(result.frontmatterType).toBe("toml");
    expect(result.data).toBeNull();
  });

  test("ignores unterminated frontmatter", () => {
    const input = ["---", "title: Hello"].join("\n");
    const result = parseMarkdown(input);
    expect(result.frontmatter).toBeNull();
    expect(result.content).toBe(input);
  });
});

describe("countSections", () => {
  test("returns per-key items for frontmatter", () => {
    const result = countSections(YAML_SAMPLE, "per-key", "chunk");
    expect(result.items.map((item) => item.name)).toEqual(["title", "summary"]);
    expect(result.total).toBeGreaterThan(0);
  });

  test("split-per-key includes content", () => {
    const result = countSections(YAML_SAMPLE, "split-per-key", "chunk");
    const names = result.items.map((item) => item.name);
    expect(names).toContain("content");
  });
});
