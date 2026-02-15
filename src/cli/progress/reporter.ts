export type ProgressOutputStream = {
  isTTY?: boolean;
  write: (chunk: string) => unknown;
};

export type BatchProgressSnapshot = {
  completed: number;
  total: number;
};

export type BatchProgressReporter = {
  enabled: boolean;
  start: (total: number, startedAtMs?: number) => void;
  advance: (snapshot: BatchProgressSnapshot) => void;
  finish: () => void;
};

type BatchProgressReporterOptions = {
  enabled: boolean;
  stream: ProgressOutputStream;
  clearOnFinish?: boolean;
};

const PROGRESS_BAR_WIDTH = 20;
const FILLED_BAR_CHAR = "█";
const EMPTY_BAR_CHAR = "░";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildProgressBar(completed: number, total: number): string {
  const safeTotal = Math.max(total, 1);
  const ratio = clamp(completed / safeTotal, 0, 1);
  const filled = completed >= safeTotal ? PROGRESS_BAR_WIDTH : Math.floor(ratio * PROGRESS_BAR_WIDTH);
  const empty = PROGRESS_BAR_WIDTH - filled;
  return `${FILLED_BAR_CHAR.repeat(filled)}${EMPTY_BAR_CHAR.repeat(empty)}`;
}

function formatElapsed(startedAtMs: number): string {
  const elapsedMs = Date.now() - startedAtMs;
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((Math.max(0, elapsedMs) % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function buildProgressLine(completed: number, total: number, startedAtMs: number): string {
  const safeTotal = Math.max(total, 1);
  const percent = completed >= safeTotal ? 100 : Math.floor((completed / safeTotal) * 100);
  const bar = buildProgressBar(completed, safeTotal);
  const percentText = `${String(percent).padStart(3, " ")}%`;
  const completedText = String(completed).padStart(String(safeTotal).length, " ");
  const elapsed = formatElapsed(startedAtMs);
  return `Counting files [${bar}] ${percentText} ${completedText}/${safeTotal} elapsed ${elapsed}`;
}

export function createBatchProgressReporter(
  options: BatchProgressReporterOptions,
): BatchProgressReporter {
  const enabled = options.enabled;
  const isTTY = Boolean(options.stream.isTTY);
  const clearOnFinish = options.clearOnFinish ?? true;
  let active = false;
  let total = 0;
  let lastLineLength = 0;
  let startedAtMs = 0;
  let lastRenderedPercent = -1;

  const render = (completed: number): void => {
    const line = buildProgressLine(completed, total, startedAtMs);
    const safeTotal = Math.max(total, 1);
    const percent = completed >= safeTotal ? 100 : Math.floor((completed / safeTotal) * 100);
    if (!isTTY && percent === lastRenderedPercent && completed < safeTotal) {
      return;
    }

    lastRenderedPercent = percent;

    lastLineLength = line.length;
    if (isTTY) {
      options.stream.write(`\r${line}`);
      return;
    }

    options.stream.write(`${line}\n`);
  };

  const clearLine = (): void => {
    if (lastLineLength === 0) {
      return;
    }
    options.stream.write(`\r${" ".repeat(lastLineLength)}\r`);
    lastLineLength = 0;
  };

  return {
    enabled,
    start(nextTotal, nextStartedAtMs) {
      if (!enabled || nextTotal <= 1) {
        return;
      }

      total = nextTotal;
      active = true;
      startedAtMs = nextStartedAtMs ?? Date.now();
      lastRenderedPercent = -1;
      render(0);
    },
    advance(snapshot) {
      if (!active) {
        return;
      }

      render(snapshot.completed);
    },
    finish() {
      if (!active) {
        return;
      }

      if (isTTY) {
        if (clearOnFinish) {
          clearLine();
        } else {
          options.stream.write("\n");
        }
      }
      active = false;
    },
  };
}
