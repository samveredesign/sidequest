const KEY = "sq_play_bootstrap";

export function markPlayBootstrap(gameId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, gameId);
  } catch {
    /* ignore */
  }
}

export function peekPlayBootstrap(gameId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(KEY) === gameId;
  } catch {
    return false;
  }
}

export function clearPlayBootstrap() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
