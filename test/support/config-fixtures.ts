import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeTomlConfig(directory: string, lines: string[]): Promise<void> {
  await writeFile(join(directory, "wc-intl-seg.config.toml"), lines.join("\n"));
}

export async function writeJsonConfig(directory: string, config: unknown): Promise<void> {
  await writeFile(join(directory, "wc-intl-seg.config.json"), JSON.stringify(config));
}
