export async function runBoundedQueue<T>(
  total: number,
  requestedJobs: number,
  worker: (index: number) => Promise<T>,
): Promise<T[]> {
  if (total === 0) {
    return [];
  }

  const safeRequestedJobs = Number.isFinite(requestedJobs) ? Math.floor(requestedJobs) : 1;
  const concurrency = Math.max(1, Math.min(total, safeRequestedJobs));
  const results: Array<T | undefined> = Array.from({ length: total });
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= total) {
        return;
      }

      results[current] = await worker(current);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  if (results.some((result) => result === undefined)) {
    throw new Error("Bounded queue completed with missing results.");
  }
  return results as T[];
}
