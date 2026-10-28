import type { Prisma } from "@prisma/client";
import { ensureQuestCatalogSeeded } from "@/lib/ensure-quest-catalog";
import { prisma } from "@/lib/prisma";
import { selectQuestIds } from "@/lib/quest-select";

type TxOrPrisma = Prisma.TransactionClient | typeof prisma;

export type PickRandomQuestsOptions = {
  /** If set, other players' quests in this game count as already used. */
  gameId?: string;
  /**
   * When `gameId` is set, whether quests already dealt in the game are off-limits
   * until the unused pool runs out.
   * `false` for Secret Alliance (partners can share the same quest lines by design).
   * @default true when `gameId` is set
   */
  gameWideExclusion?: boolean;
  /**
   * Extra quest IDs to treat as already used (for example IDs reserved in this
   * deal before their rows are written).
   */
  extraExclude?: ReadonlySet<string>;
  /**
   * Use a transaction client so pool reads match pending writes in the same
   * transaction (for example after marking a quest failed).
   */
  tx?: Prisma.TransactionClient;
};

/**
 * Pick `count` quest IDs this player has never held.
 * Across the game, a quest is duplicated onto another player only when every
 * still-unused quest has already been dealt.
 */
export async function pickRandomQuestIdsForPlayer(
  playerId: string,
  count: number,
  options?: PickRandomQuestsOptions,
): Promise<string[]> {
  await ensureQuestCatalogSeeded();
  const { gameId, gameWideExclusion, extraExclude = new Set<string>(), tx } = options ?? {};
  const applyGameWide = Boolean(gameId) && (gameWideExclusion ?? true);
  const db: TxOrPrisma = tx ?? prisma;

  const existing = await db.playerQuest.findMany({
    where: { playerId },
    select: { questId: true },
  });
  const playerHistory = existing.map((row) => row.questId);

  const usedInGame = new Set<string>(extraExclude);
  if (applyGameWide) {
    const dealt = await db.playerQuest.findMany({
      where: { player: { gameId: gameId! } },
      select: { questId: true },
    });
    for (const row of dealt) usedInGame.add(row.questId);
  }

  const allQuests = await db.quest.findMany({
    where: { allianceOnly: false },
    select: { id: true },
  });

  return selectQuestIds({
    allQuestIds: allQuests.map((quest) => quest.id),
    playerHistory,
    usedInGame: [...usedInGame],
    count,
  });
}

export async function assignInitialQuestsToPlayers(
  gameId: string,
  numberOfQuests: number,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const players = await tx.player.findMany({
    where: { gameId, status: "ACTIVE", leftAt: null },
  });
  const order = [...players].sort(() => Math.random() - 0.5);

  for (const player of order) {
    const questIds = await pickRandomQuestIdsForPlayer(player.id, numberOfQuests, {
      gameId,
      tx,
    });
    await tx.playerQuest.createMany({
      data: questIds.map((questId) => ({
        playerId: player.id,
        questId,
        status: "ACTIVE" as const,
      })),
    });
  }
}

export async function assignQuestsToPlayer(
  playerId: string,
  numberOfQuests: number,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const player = await tx.player.findUnique({
    where: { id: playerId },
    select: { gameId: true, game: { select: { mode: true } } },
  });
  if (!player) {
    throw new Error("Player not found");
  }

  const questIds = await pickRandomQuestIdsForPlayer(playerId, numberOfQuests, {
    gameId: player.gameId,
    gameWideExclusion: player.game.mode !== "SECRET_ALLIANCE",
    tx,
  });
  await tx.playerQuest.createMany({
    data: questIds.map((questId) => ({
      playerId,
      questId,
      status: "ACTIVE" as const,
    })),
  });
}
