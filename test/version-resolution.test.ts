import { describe, expect, test } from "bun:test";
import { resolvePackageVersion } from "../src/cli/program/version";

describe("version resolution", () => {
  test("prefers embedded version over package lookup roots", () => {
    const resolved = resolvePackageVersion({
      embeddedVersion: "9.9.9",
      candidateRoots: ["/tmp/a", "/tmp/b"],
      resolveFromPath: () => "1.2.3",
    });

    expect(resolved).toBe("9.9.9");
  });

  test("falls back to package lookup when embedded version is unavailable", () => {
    const resolved = resolvePackageVersion({
      embeddedVersion: "",
      candidateRoots: ["/tmp/a", "/tmp/b"],
      resolveFromPath: (root) => (root === "/tmp/b" ? "1.2.3" : null),
    });

    expect(resolved).toBe("1.2.3");
  });

  test("returns 0.0.0 when embedded and package lookups are unavailable", () => {
    const resolved = resolvePackageVersion({
      embeddedVersion: "",
      candidateRoots: ["/tmp/a"],
      resolveFromPath: () => null,
    });

    expect(resolved).toBe("0.0.0");
  });
});
