import { prisma } from "@/lib/prisma";
import { normalizePlayerName } from "@/lib/names";
import type { Prisma } from "@prisma/client";

type Opts = {
  excludeJoinRequestId?: string;
  tx?: Prisma.TransactionClient;
};

export async function isNameTakenInGame(
  gameId: string,
  displayName: string,
  opts?: Opts,
): Promise<boolean> {
  const db = opts?.tx ?? prisma;
  const norm = normalizePlayerName(displayName);
  const players = await db.player.findMany({
    where: { gameId, status: { not: "LEFT" } },
    select: { name: true },
  });
  if (players.some((p) => normalizePlayerName(p.name) === norm)) {
    return true;
  }
  const pending = await db.joinRequest.findMany({
    where: {
      gameId,
      status: "PENDING",
      ...(opts?.excludeJoinRequestId
        ? { id: { not: opts.excludeJoinRequestId } }
        : {}),
    },
    select: { playerName: true },
  });
  return pending.some((r) => normalizePlayerName(r.playerName) === norm);
}
