/** Starting quests chosen by the host. Enforced in the start form and on the server. */
export const MIN_STARTING_QUESTS = 1;
export const MAX_STARTING_QUESTS = 10;

/** Host-chosen cap on failed quests per player. 0 disables Fail. */
export const MIN_FAILS_PER_PLAYER = 0;
export const MAX_FAILS_PER_PLAYER = 10;
export const DEFAULT_FAILS_PER_PLAYER = 5;

export function isAllowedFailLimit(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_FAILS_PER_PLAYER &&
    value <= MAX_FAILS_PER_PLAYER
  );
}

export function failUnavailableMessage(maxFails: number): string {
  if (maxFails <= 0) {
    return "Fail is unavailable — this game does not allow failed quests.";
  }
  return `Fail is unavailable — you have used all ${maxFails} fails this game.`;
}

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
