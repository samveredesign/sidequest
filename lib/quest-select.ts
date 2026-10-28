function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export type SelectQuestIdsInput = {
  allQuestIds: readonly string[];
  /** Every quest this player has already held (active, completed, or failed). */
  playerHistory: readonly string[];
  /** Quests already used in the game. Duplicates of these are a last resort. */
  usedInGame: readonly string[];
  count: number;
  random?: () => number;
};

/**
 * Pick `count` quests this player has never held.
 * Quests already used by anyone in the game are reused only after the unused pool is too small.
 */
export function selectQuestIds(input: SelectQuestIdsInput): string[] {
  if (input.count <= 0) return [];

  const history = new Set(input.playerHistory);
  const used = new Set(input.usedInGame);
  const eligible = input.allQuestIds.filter((id) => !history.has(id));

  if (eligible.length < input.count) {
    throw new Error("Not enough quests left that this player has not already had.");
  }

  const unique = eligible.filter((id) => !used.has(id));
  const duplicates = eligible.filter((id) => used.has(id));
  const random = input.random ?? Math.random;
  const shuffledUnique = shuffle(unique, random);

  if (shuffledUnique.length >= input.count) {
    return shuffledUnique.slice(0, input.count);
  }

  const need = input.count - shuffledUnique.length;
  const shuffledDupes = shuffle(duplicates, random);
  return [...shuffledUnique, ...shuffledDupes.slice(0, need)];
}
