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
    expect(result.content).toBe("Body");
  });

  test("treats invalid JSON frontmatter as content", () => {
    const input = ["{title: Hello}", "Body"].join("\n");
    const result = parseMarkdown(input);
    expect(result.frontmatter).toBeNull();
    expect(result.frontmatterType).toBeNull();
    expect(result.content).toBe(input);
  });

  test("detects TOML fences", () => {
    const input = ["+++", "title = \"Hello\"", "+++", "Body"].join("\n");
    const result = parseMarkdown(input);
    expect(result.frontmatterType).toBe("toml");
    expect(result.data?.title).toBe("Hello");
  });

  test("parses TOML tables and arrays", () => {
    const input = [
      "+++",
      "title = \"Hello\"",
      "tags = [\"a\", \"b\"]",
      "params.author = \"Ada\"",
      "[params]",
      "author = \"Ada\"",
      "+++",
      "Body",
    ].join("\n");
    const result = parseMarkdown(input);
    expect(result.data?.title).toBe("Hello");
    expect(result.data?.tags).toBe("a, b");
    expect(result.data?.["params.author"]).toBe("Ada");
  });

  test("parses TOML inline tables", () => {
    const input = [
      "+++",
      "author = { name = \"Ada\", role = \"Editor\", tags = [\"a\", \"b\"] }",
      "+++",
      "Body",
    ].join("\n");
    const result = parseMarkdown(input);
    expect(result.data?.["author.name"]).toBe("Ada");
    expect(result.data?.["author.role"]).toBe("Editor");
    expect(result.data?.["author.tags"]).toBe("a, b");
  });

  test("parses TOML multiline strings and escapes", () => {
    const input = [
      "+++",
      "title = \"Hello\\nWorld\"",
      "summary = \"\"\"Line1\\nLine2\"\"\" # note",
      "note = '''LineA",
      "LineB'''",
      "+++",
      "Body",
    ].join("\n");
    const result = parseMarkdown(input);
    expect(result.data?.title).toBe("Hello\nWorld");
    expect(result.data?.summary).toBe("Line1\nLine2");
    expect(result.data?.note).toBe("LineA\nLineB");
  });

  test("parses TOML arrays of tables (single entry)", () => {
    const input = ["+++", "[[items]]", "name = \"bad\"", "+++", "Body"].join("\n");
    const result = parseMarkdown(input);
    expect(result.data?.items).toBe("name=bad");
  });

  test("parses TOML arrays of tables", () => {
    const input = [
      "+++",
      "[[authors]]",
      "name = \"Ada\"",
      "[[authors]]",
      "name = \"Grace\"",
      "+++",
      "Body",
    ].join("\n");
    const result = parseMarkdown(input);
    expect(result.data?.authors).toBe("name=Ada | name=Grace");
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
    const result = countSections(YAML_SAMPLE, "per-key", { mode: "chunk" });
    expect(result.items.map((item) => item.name)).toEqual(["title", "summary"]);
    expect(result.total).toBeGreaterThan(0);
  });

  test("split-per-key includes content", () => {
    const result = countSections(YAML_SAMPLE, "split-per-key", { mode: "chunk" });
    const names = result.items.map((item) => item.name);
    expect(names).toContain("content");
  });
});
