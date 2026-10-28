export type ProgressPlayer = {
  id: string;
  name: string;
  score: number;
  finishedAt: string | null;
  completedQuests: number;
};

/** Least progress first: fewer completions, then lower score, then unfinished, then later finish. */
export function compareLeastProgressFirst(a: ProgressPlayer, b: ProgressPlayer): number {
  if (a.completedQuests !== b.completedQuests) {
    return a.completedQuests - b.completedQuests;
  }
  if (a.score !== b.score) return a.score - b.score;
  const aUnfinished = a.finishedAt ? 1 : 0;
  const bUnfinished = b.finishedAt ? 1 : 0;
  if (aUnfinished !== bUnfinished) return aUnfinished - bUnfinished;
  if (a.finishedAt && b.finishedAt && a.finishedAt !== b.finishedAt) {
    return a.finishedAt > b.finishedAt ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

export function pickLeastProgressPlayer<T extends ProgressPlayer>(players: readonly T[]): T | null {
  if (players.length === 0) return null;
  return [...players].sort(compareLeastProgressFirst)[0] ?? null;
}

export function pickFirstFinisher<T extends ProgressPlayer>(players: readonly T[]): T | null {
  const finished = players.filter((player) => player.finishedAt);
  if (finished.length === 0) return null;
  return (
    [...finished].sort((a, b) => {
      if (a.finishedAt !== b.finishedAt) {
        return a.finishedAt! < b.finishedAt! ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })[0] ?? null
  );
}

export function sortLeaderboardPlayers<T extends ProgressPlayer>(
  mode: string,
  gameStatus: string,
  players: readonly T[],
): T[] {
  const copy = [...players];
  if (mode === "FIRST_FINISH_WINS") {
    copy.sort((a, b) => {
      const aFinished = a.finishedAt ? 0 : 1;
      const bFinished = b.finishedAt ? 0 : 1;
      if (aFinished !== bFinished) return aFinished - bFinished;
      if (a.finishedAt && b.finishedAt && a.finishedAt !== b.finishedAt) {
        return a.finishedAt < b.finishedAt ? -1 : 1;
      }
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }
  if (mode === "LAST_FINISH_LOSES" && gameStatus === "FINISHED") {
    copy.sort((a, b) => compareLeastProgressFirst(b, a));
    return copy;
  }
  copy.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.finishedAt && b.finishedAt && a.finishedAt !== b.finishedAt) {
      return a.finishedAt < b.finishedAt ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return copy;
}
