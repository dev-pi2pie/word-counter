import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliHarness } from "./support/cli-harness";

const { captureCli, makeTempFixture } = createCliHarness();

describe("CLI compatibility gates", () => {
  test("keeps single-input standard output behavior", async () => {
    const output = await captureCli(["Hello", "world"]);
    expect(output.stdout[0]).toBe("Total words: 2");
  });

  test("keeps single-input raw output contract", async () => {
    const output = await captureCli(["--format", "raw", "Hello", "world"]);
    expect(output.stdout).toEqual(["2"]);
  });

  test("keeps single-input json output contract", async () => {
    const output = await captureCli(["--format", "json", "Hello", "world"]);
    expect(output.stdout.length).toBe(1);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.total).toBe(2);
    expect(parsed.breakdown.mode).toBe("chunk");
    expect(parsed.scope).toBeUndefined();
  });

  test("keeps single --path behavior unchanged", async () => {
    const root = await makeTempFixture("cli-single-path");
    const singlePath = join(root, "single.txt");
    await writeFile(singlePath, "hello world");

    const standard = await captureCli(["--path", singlePath]);
    expect(standard.stdout[0]).toBe("Total words: 2");
    expect(standard.stdout.some((line) => line.includes("[Merged]"))).toBeFalse();

    const raw = await captureCli(["--path", singlePath, "--format", "raw"]);
    expect(raw.stdout).toEqual(["2"]);

    const json = await captureCli(["--path", singlePath, "--format", "json"]);
    const parsed = JSON.parse(json.stdout[0] ?? "{}");
    expect(parsed.total).toBe(2);
    expect(parsed.scope).toBeUndefined();
  });

  test("treats empty single --path file as valid zero-count input", async () => {
    const root = await makeTempFixture("cli-single-path-empty");
    const singlePath = join(root, "empty.txt");
    await writeFile(singlePath, "");

    const standard = await captureCli(["--path", singlePath]);
    expect(standard.stdout[0]).toBe("Total words: 0");
    expect(standard.stderr).toEqual([]);

    const raw = await captureCli(["--path", singlePath, "--format", "raw"]);
    expect(raw.stdout).toEqual(["0"]);
    expect(raw.stderr).toEqual([]);

    const json = await captureCli(["--path", singlePath, "--format", "json"]);
    const parsed = JSON.parse(json.stdout[0] ?? "{}");
    expect(parsed.total).toBe(0);
    expect(parsed.scope).toBeUndefined();
    expect(json.stderr).toEqual([]);
  });

  test("treats whitespace-only single --path file as valid zero-count input", async () => {
    const root = await makeTempFixture("cli-single-path-whitespace");
    const singlePath = join(root, "whitespace.txt");
    await writeFile(singlePath, " \n\t ");

    const standard = await captureCli(["--path", singlePath]);
    expect(standard.stdout[0]).toBe("Total words: 0");
    expect(standard.stderr).toEqual([]);

    const raw = await captureCli(["--path", singlePath, "--format", "raw"]);
    expect(raw.stdout).toEqual(["0"]);
    expect(raw.stderr).toEqual([]);
  });

  test("accepts --latin-language hint for ambiguous Latin text", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-language",
      "en",
      "Hello",
      "world",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("en");
  });

  test("prefers --latin-tag over --latin-language and --latin-locale", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-locale",
      "en",
      "--latin-language",
      "fr",
      "--latin-tag",
      "de",
      "Hello",
      "world",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("de");
  });

  test("treats empty --latin-tag as missing and falls back to --latin-language", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-locale",
      "en",
      "--latin-language",
      "fr",
      "--latin-tag",
      "",
      "Hello",
      "world",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("fr");
  });

  test("accepts repeated --latin-hint for custom Latin locale detection", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--latin-hint",
      "pl=[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]",
      "Zażółć",
      "gęślą",
      "jaźń",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("pl");
  });

  test("merges --latin-hints-file with CLI custom hints deterministically", async () => {
    const root = await makeTempFixture("cli-latin-hints-merge");
    const rulesPath = join(root, "latin-hints.json");
    await writeFile(rulesPath, JSON.stringify([{ tag: "ro", pattern: "[șȘ]" }]), "utf8");

    const output = await captureCli([
      "--format",
      "json",
      "--latin-hints-file",
      rulesPath,
      "--latin-hint",
      "es=[șȘ]",
      "ș",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("es");
  });

  test("supports --no-default-latin-hints", async () => {
    const withDefaults = await captureCli(["--format", "json", "Über"]);
    const withDefaultsParsed = JSON.parse(withDefaults.stdout[0] ?? "{}");
    expect(withDefaultsParsed.breakdown.items[0]?.locale).toBe("de");

    const withoutDefaults = await captureCli([
      "--format",
      "json",
      "--no-default-latin-hints",
      "Über",
    ]);
    const withoutDefaultsParsed = JSON.parse(withoutDefaults.stdout[0] ?? "{}");
    expect(withoutDefaultsParsed.breakdown.items[0]?.locale).toBe("und-Latn");
  });

  test("accepts --han-tag for Han text fallback", async () => {
    const output = await captureCli(["--format", "json", "--han-tag", "zh-Hant", "漢字測試"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hant");
  });

  test("accepts --han-tag for Simplified Chinese Han text fallback", async () => {
    const output = await captureCli(["--format", "json", "--han-tag", "zh-Hans", "汉字测试"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hans");
  });

  test("accepts char-collector alias matrix forms", async () => {
    const aliases = [
      "charcollector",
      "char-collect",
      "collector-char",
      "characters-collector",
      "colchar",
      "charcol",
      "char-col",
      "char-colle",
    ];

    for (const alias of aliases) {
      const output = await captureCli(["--mode", alias, "--format", "json", "Hi"]);
      const parsed = JSON.parse(output.stdout[0] ?? "{}");
      expect(parsed.breakdown.mode).toBe("char-collector");
    }
  });

  test("accepts --han-language alias for Han text fallback", async () => {
    const output = await captureCli(["--format", "json", "--han-language", "zh-Hant", "漢字測試"]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hant");
  });

  test("treats empty --han-tag as missing and uses --han-language fallback", async () => {
    const output = await captureCli([
      "--format",
      "json",
      "--han-tag",
      "",
      "--han-language",
      "zh-Hant",
      "漢字測試",
    ]);
    const parsed = JSON.parse(output.stdout[0] ?? "{}");
    expect(parsed.breakdown.items[0]?.locale).toBe("zh-Hant");
  });
});
