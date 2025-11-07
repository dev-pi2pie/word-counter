import wordCounter, {
  type WordCounterMode,
  type WordCounterResult,
} from "./wc";
import { showSingularOrPluralWord } from "./utils";

type BunRuntime = {
  argv: string[];
  stdin?: {
    text(): Promise<string>;
  };
  exit(code: number): never;
};

type NodeProcessLike = {
  argv?: string[];
  stdin?: {
    isTTY?: boolean;
    setEncoding?(encoding: string): void;
    on?(event: string, listener: (...args: any[]) => void): void;
    once?(event: string, listener: (...args: any[]) => void): void;
    resume?(): void;
  };
  exit?(code?: number): never;
};

const runtimeGlobals = globalThis as unknown as {
  Bun?: BunRuntime;
  process?: NodeProcessLike;
};

function getArgv(): string[] {
  const bunArgv = runtimeGlobals.Bun?.argv;
  if (Array.isArray(bunArgv)) {
    return bunArgv.slice(2);
  }

  const processArgv = runtimeGlobals.process?.argv;
  if (Array.isArray(processArgv)) {
    return processArgv.slice(2);
  }

  return [];
}

async function readStdin(): Promise<string> {
  const bunStdin = runtimeGlobals.Bun?.stdin;
  if (bunStdin && typeof bunStdin.text === "function") {
    return bunStdin.text();
  }

  const stdin = runtimeGlobals.process?.stdin;
  if (!stdin || stdin.isTTY) {
    return "";
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    const decoder = new TextDecoder();

    stdin.setEncoding?.("utf8");
    stdin.on?.("data", (chunk: unknown) => {
      if (typeof chunk === "string") {
        chunks.push(chunk);
      } else if (chunk instanceof Uint8Array) {
        chunks.push(decoder.decode(chunk));
      } else {
        chunks.push(String(chunk));
      }
    });
    stdin.on?.("end", () => resolve(chunks.join("")));
    stdin.on?.("error", (error: unknown) => reject(error));
    stdin.resume?.();
  });
}

function exit(code: number): never {
  const bunExit = runtimeGlobals.Bun?.exit;
  if (bunExit) {
    bunExit(code);
  }

  const processExit = runtimeGlobals.process?.exit;
  if (processExit) {
    processExit(code);
  }

  throw new Error(`Failed to exit with code ${code}`);
}

function parseMode(value: string | undefined): WordCounterMode {
  if (!value) {
    throw new Error("Missing value for --mode option");
  }

  const normalized = value.toLowerCase();
  if (normalized === "chunk" || normalized === "segments" || normalized === "collector") {
    return normalized;
  }

  throw new Error(`Unsupported mode: ${value}`);
}

function parseArgs(argv: string[]): { mode: WordCounterMode; textTokens: string[] } {
  let mode: WordCounterMode = "chunk";
  const textTokens: string[] = [];
  let collectRemainder = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (collectRemainder) {
      textTokens.push(arg);
      continue;
    }

    if (arg === "--") {
      collectRemainder = true;
      continue;
    }

    if (arg === "--mode" || arg === "-m") {
      const next = argv[i + 1];
      mode = parseMode(next);
      i++;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      mode = parseMode(arg.split("=", 2)[1]);
      continue;
    }

    textTokens.push(arg);
  }

  return { mode, textTokens };
}

function renderChunkBreakdown(items: Array<{ locale: string; words: number }>): void {
  for (const item of items) {
    console.log(
      `Locale ${item.locale}: ${showSingularOrPluralWord(item.words, "word")}`
    );
  }
}

function renderSegmentBreakdown(
  items: Array<{ locale: string; words: number; segments: string[] }>
): void {
  for (const item of items) {
    console.log(
      `Locale ${item.locale}: ${JSON.stringify(item.segments)} (${showSingularOrPluralWord(item.words, "word")})`
    );
  }
}

function renderCollectorBreakdown(items: Array<{ locale: string; words: number }>): void {
  for (const item of items) {
    console.log(
      `Locale ${item.locale}: ${showSingularOrPluralWord(item.words, "word")}`
    );
  }
}

function renderResult(result: WordCounterResult): void {
  console.log(`Total words: ${result.total}`);

  if (result.breakdown.mode === "segments") {
    renderSegmentBreakdown(result.breakdown.items);
    return;
  }

  if (result.breakdown.mode === "collector") {
    renderCollectorBreakdown(result.breakdown.items);
    return;
  }

  renderChunkBreakdown(result.breakdown.items);
}

async function main(): Promise<void> {
  const argv = getArgv();
  let parsed: { mode: WordCounterMode; textTokens: string[] };

  try {
    parsed = parseArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    exit(1);
  }

  const argsText = parsed.textTokens.join(" ");
  const argsInput = argsText.trim();

  const stdinText = argsInput.length > 0 ? "" : (await readStdin()).trim();
  const input = argsInput.length > 0 ? argsInput : stdinText;
  if (!input) {
    console.error(
      "No input provided. Pass text as arguments or pipe via stdin."
    );
    exit(1);
  }

  const result = wordCounter(input, { mode: parsed.mode });
  renderResult(result);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Failed to count words:", error);
    exit(1);
  });
}
