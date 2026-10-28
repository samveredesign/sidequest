export const LS_GAME_ID = "gameId";
export const LS_PLAYER_ID = "playerId";
export const LS_PLAYER_TOKEN = "playerToken";

export type StoredSession = {
  gameId: string | null;
  playerId: string | null;
  token: string | null;
};

export function saveSession(gameId: string, playerId: string, token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_GAME_ID, gameId);
  localStorage.setItem(LS_PLAYER_ID, playerId);
  localStorage.setItem(LS_PLAYER_TOKEN, token);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_GAME_ID);
  localStorage.removeItem(LS_PLAYER_ID);
  localStorage.removeItem(LS_PLAYER_TOKEN);
}

export function readSession(): StoredSession {
  if (typeof window === "undefined") {
    return { gameId: null, playerId: null, token: null };
  }
  return {
    gameId: localStorage.getItem(LS_GAME_ID),
    playerId: localStorage.getItem(LS_PLAYER_ID),
    token: localStorage.getItem(LS_PLAYER_TOKEN),
  };
}

/** Token for a not-yet-accepted join, kept in this tab until the host responds. */
export function joinTokenStorageKey(requestId: string): string {
  return `joinToken:${requestId}`;
}

export function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = { "x-player-token": token };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}
