import type { Prisma, PrismaClient } from "@prisma/client";

/** Odd total → one trio, rest pairs; even → all pairs. */
export function allianceSizesForPlayerCount(total: number): number[] {
  if (total <= 0) return [];
  if (total === 1) return [1];
  if (total % 2 === 0) {
    return Array.from({ length: total / 2 }, () => 2);
  }
  return [3, ...Array.from({ length: (total - 3) / 2 }, () => 2)];
}

type Tx = Prisma.TransactionClient;

export async function assignSecretAllianceInTx(
  tx: Tx,
  gameId: string,
  numberOfQuests: number,
): Promise<void> {
  const players = await tx.player.findMany({
    where: { gameId, status: "ACTIVE", leftAt: null },
    orderBy: { createdAt: "asc" },
  });
  const shuffledPlayers = [...players];
  for (let i = shuffledPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j]!, shuffledPlayers[i]!];
  }

  const sizes = allianceSizesForPlayerCount(shuffledPlayers.length);
  let offset = 0;
  let groupId = 0;
  const groups = new Map<number, string[]>();
  for (const size of sizes) {
    const chunk = shuffledPlayers.slice(offset, offset + size);
    offset += size;
    groups.set(groupId, chunk.map((p) => p.id));
    for (const p of chunk) {
      await tx.player.update({
        where: { id: p.id },
        data: { allianceGroup: groupId },
      });
    }
    groupId += 1;
  }

  const allianceQuests = await tx.quest.findMany({
    where: { allianceOnly: true },
    select: { id: true },
  });
  if (allianceQuests.length < numberOfQuests) {
    throw new Error("Not enough alliance-only quests in database");
  }

  for (const memberIds of groups.values()) {
    const shuffled = [...allianceQuests.map((q) => q.id)].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, numberOfQuests);
    for (const memberId of memberIds) {
      await tx.playerQuest.createMany({
        data: picked.map((questId, slotIndex) => ({
          playerId: memberId,
          questId,
          status: "ACTIVE" as const,
          slotIndex,
        })),
      });
    }
  }
}

/** All alliance quest slots completed by every active member. */
export async function canAllianceSubmit(
  db: Tx | Pick<PrismaClient, "player" | "playerQuest">,
  playerId: string,
): Promise<boolean> {
  const player = await db.player.findUnique({
    where: { id: playerId },
    include: { game: true },
  });
  if (!player || player.game.mode !== "SECRET_ALLIANCE") return false;
  if (player.status !== "ACTIVE" || player.game.status !== "ACTIVE") return false;
  if (player.allianceGroup == null) return false;

  const allies = await db.player.findMany({
    where: {
      gameId: player.gameId,
      allianceGroup: player.allianceGroup,
      status: "ACTIVE",
      leftAt: null,
    },
  });
  if (allies.length === 0) return false;

  const slotCount = await db.playerQuest.count({
    where: { playerId },
  });
  if (slotCount === 0) return false;

  for (let slot = 0; slot < slotCount; slot++) {
    for (const a of allies) {
      const done = await db.playerQuest.findFirst({
        where: { playerId: a.id, slotIndex: slot, status: "COMPLETED" },
      });
      if (!done) return false;
    }
  }
  return true;
}
