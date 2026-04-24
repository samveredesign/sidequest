import { prisma } from "@/lib/prisma";
import { normalizePlayerName } from "@/lib/names";

type Opts = { excludeJoinRequestId?: string };

export async function isNameTakenInGame(
  gameId: string,
  displayName: string,
  opts?: Opts,
): Promise<boolean> {
  const norm = normalizePlayerName(displayName);
  const players = await prisma.player.findMany({
    where: { gameId, status: { not: "LEFT" } },
    select: { name: true },
  });
  if (players.some((p) => normalizePlayerName(p.name) === norm)) {
    return true;
  }
  const pending = await prisma.joinRequest.findMany({
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
