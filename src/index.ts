import countWords from "./wc";

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

async function readInput(): Promise<string> {
  const args = getArgv();
  if (args.length > 0) {
    return args.join(" ");
  }
  return await readStdin();
}

async function main(): Promise<void> {
  const input = (await readInput()).trim();
  if (!input) {
    console.error(
      "No input provided. Pass text as arguments or pipe via stdin."
    );
    exit(1);
  }

  const { total, breakdown } = countWords(input);
  console.log(`Total words: ${total}`);
  for (const chunk of breakdown) {
    console.log(`Locale ${chunk.locale}: ${chunk.words} words`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Failed to count words:", error);
    exit(1);
  });
}
