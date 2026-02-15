type DebugDetails = Record<string, unknown>;

export type DebugChannel = {
  enabled: boolean;
  emit: (event: string, details?: DebugDetails) => void;
};

export function createDebugChannel(enabled: boolean): DebugChannel {
  return {
    enabled,
    emit(event, details = {}) {
      if (!enabled) {
        return;
      }

      const payload = {
        event,
        ...details,
      };
      console.error(`[debug] ${JSON.stringify(payload)}`);
    },
  };
}
