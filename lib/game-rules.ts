/** Starting quests chosen by the host. Enforced in the start form and on the server. */
export const MIN_STARTING_QUESTS = 1;
export const MAX_STARTING_QUESTS = 10;

/** Successful fails allowed for one player in one game. */
export const MAX_FAILS_PER_PLAYER = 5;

/** Replacement quests dealt when a player fails one quest. */
export const QUESTS_GRANTED_ON_FAIL = 2;

/**
 * An active player who stops polling (tab closed) is marked left after this long.
 * Longer than a refresh, shorter than leaving Last to Finish Loses stuck forever.
 * Override with PRESENCE_STALE_MS for tests.
 */
export function presenceStaleMs(): number {
  const raw = process.env.PRESENCE_STALE_MS;
  if (!raw) return 90_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) return 90_000;
  return n;
}

export function formatFailsLeft(failsLeft: number): string {
  return failsLeft === 1 ? "1 fail left" : `${failsLeft} fails left`;
}
