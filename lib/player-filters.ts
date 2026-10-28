import type { Game, Player } from "@prisma/client";

/** Lobby / in-game list: hide players who left. */
export function includeInLobbyPlayerList(p: Player): boolean {
  return p.status !== "LEFT";
}

/**
 * Leaderboard table:
 * - Hide players who left before the game ended.
 * - LAST_FINISH_LOSES while the round is still going: only players who submitted.
 * - LAST_FINISH_LOSES after the game ends: everyone still in the game, so the
 *   player with the least progress is visible.
 */
export function includeInLeaderboardList(p: Player, game: Game): boolean {
  if (p.status === "LEFT") {
    if (!p.leftAt) return false;
    if (game.finishedAt && p.leftAt >= game.finishedAt) return true;
    if (p.finishedAt != null) return true;
    return false;
  }
  if (game.mode === "LAST_FINISH_LOSES" && game.status !== "FINISHED") {
    return p.finishedAt != null;
  }
  return true;
}
