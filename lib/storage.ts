export const LS_GAME_ID = "gameId";
export const LS_PLAYER_ID = "playerId";

export function saveSession(gameId: string, playerId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_GAME_ID, gameId);
  localStorage.setItem(LS_PLAYER_ID, playerId);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_GAME_ID);
  localStorage.removeItem(LS_PLAYER_ID);
}

export function readSession(): { gameId: string | null; playerId: string | null } {
  if (typeof window === "undefined") {
    return { gameId: null, playerId: null };
  }
  return {
    gameId: localStorage.getItem(LS_GAME_ID),
    playerId: localStorage.getItem(LS_PLAYER_ID),
  };
}
