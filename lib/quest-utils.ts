import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxOrPrisma = Prisma.TransactionClient | typeof prisma;

export type PickRandomQuestsOptions = {
  /** If set, exclude quest IDs that are **active** on any other player in this game. */
  gameId?: string;
  /**
   * When `gameId` is set, whether to treat other players' active quests as off-limits.
   * `false` for Secret Alliance (partners can share the same quest lines by design).
   * @default true when `gameId` is set
   */
  gameWideExclusion?: boolean;
  /**
   * Extra quest IDs to exclude (e.g. all IDs already given to other players in the same
   * initial deal before their rows are written).
   */
  extraExclude?: ReadonlySet<string>;
  /**
   * Use a transaction client so "active" and pool reads match pending writes in the
   * same transaction (e.g. after marking a quest failed, before creating replacements).
   */
  tx?: Prisma.TransactionClient;
};

/**
 * Pick `count` **distinct** random quest IDs (non–alliance-only pool) not in the
 * exclusion set: this player's full history, optional `extraExclude`, and (unless disabled)
 * any **active** quest on another player in the same `gameId`.
 */
export async function pickRandomQuestIdsForPlayer(
  playerId: string,
  count: number,
  options?: PickRandomQuestsOptions,
): Promise<string[]> {
  const { gameId, gameWideExclusion, extraExclude = new Set<string>(), tx } = options ?? {};
  const applyGameWide = Boolean(gameId) && (gameWideExclusion ?? true);
  const db: TxOrPrisma = tx ?? prisma;

  const existing = await db.playerQuest.findMany({
    where: { playerId },
    select: { questId: true },
  });
  const exclude = new Set<string>([
    ...existing.map((e) => e.questId),
    ...extraExclude,
  ]);

  if (applyGameWide) {
    const otherActive = await db.playerQuest.findMany({
      where: {
        player: { gameId: gameId! },
        status: "ACTIVE",
        playerId: { not: playerId },
      },
      select: { questId: true },
    });
    for (const o of otherActive) {
      exclude.add(o.questId);
    }
  }

  const allQuests = await db.quest.findMany({
    where: { allianceOnly: false },
    select: { id: true },
  });
  const pool = allQuests.map((q) => q.id).filter((id) => !exclude.has(id));

  if (pool.length < count) {
    throw new Error(
      "Not enough unique quests in the pool for this game (pool exhausted for non–Secret Alliance).",
    );
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function assignInitialQuestsToPlayers(
  gameId: string,
  numberOfQuests: number,
): Promise<void> {
  const players = await prisma.player.findMany({
    where: { gameId, status: "ACTIVE", leftAt: null },
  });
  const order = [...players].sort(() => Math.random() - 0.5);
  const assignedInGame = new Set<string>();

  for (const player of order) {
    const questIds = await pickRandomQuestIdsForPlayer(player.id, numberOfQuests, {
      gameId,
      extraExclude: assignedInGame,
    });
    for (const id of questIds) {
      assignedInGame.add(id);
    }
    await prisma.playerQuest.createMany({
      data: questIds.map((qid) => ({
        playerId: player.id,
        questId: qid,
        status: "ACTIVE" as const,
      })),
    });
  }
}

export async function assignQuestsToPlayer(
  playerId: string,
  numberOfQuests: number,
): Promise<void> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { gameId: true, game: { select: { mode: true } } },
  });
  if (!player) {
    throw new Error("Player not found");
  }

  const questIds = await pickRandomQuestIdsForPlayer(playerId, numberOfQuests, {
    gameId: player.gameId,
    gameWideExclusion: player.game.mode !== "SECRET_ALLIANCE",
  });
  await prisma.playerQuest.createMany({
    data: questIds.map((questId) => ({
      playerId,
      questId,
      status: "ACTIVE" as const,
    })),
  });
}
