import type { GameStateJson } from "@/lib/game-state-types";

/** Client-side route for a session, based on polled game JSON from GET /api/games/[id]. */
export function pathForGameSession(data: {
  game: { id: string; status: string; mode: string };
  me: { status: string } | null;
}): string | null {
  const { game, me } = data;
  if (!me) return null;
  if (me.status === "LEFT") return null;

  const gid = game.id;

  if (game.status === "LOBBY") {
    return `/games/${gid}/lobby`;
  }

  if (game.status === "FINISHED") {
    return `/games/${gid}/leaderboard`;
  }

  if (game.status === "ACTIVE") {
    if (game.mode === "LAST_FINISH_LOSES" && me.status === "FINISHED") {
      return `/games/${gid}/leaderboard`;
    }
    return `/games/${gid}/play`;
  }

  return `/games/${gid}/lobby`;
}

export function canViewLeaderboard(state: GameStateJson): boolean {
  if (state.game.status === "FINISHED") return true;
  if (
    state.game.status === "ACTIVE" &&
    state.game.mode === "LAST_FINISH_LOSES" &&
    state.me?.status === "FINISHED"
  ) {
    return true;
  }
  return false;
}
