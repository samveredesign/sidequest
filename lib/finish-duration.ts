/** Human-readable duration from game start to player finish. */

export function formatFinishDuration(
  gameStartedAtIso: string | null,
  playerFinishedAtIso: string | null,
): string {
  if (!gameStartedAtIso || !playerFinishedAtIso) return "—";
  const start = new Date(gameStartedAtIso).getTime();
  const end = new Date(playerFinishedAtIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";

  const totalMin = Math.floor((end - start) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}
