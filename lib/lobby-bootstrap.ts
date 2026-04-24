const KEY = "sq_lobby_bootstrap";

export function markLobbyBootstrap(gameId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, gameId);
  } catch {
    /* ignore */
  }
}

export function peekLobbyBootstrap(gameId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(KEY) === gameId;
  } catch {
    return false;
  }
}

export function clearLobbyBootstrap() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
