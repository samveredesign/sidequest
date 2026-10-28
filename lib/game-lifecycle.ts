import { lockGame } from "@/lib/db-lock";
import { presenceStaleMs } from "@/lib/game-rules";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * If nobody who is still in the game is host, pass the role to the earliest
 * active player, then the earliest finished player. End an active game once
 * nobody is still playing.
 */
export async function ensureHostAndMaybeFinish(
  tx: Prisma.TransactionClient,
  gameId: string,
  now: Date,
): Promise<void> {
  const host = await tx.player.findFirst({
    where: { gameId, isHost: true, status: { not: "LEFT" } },
    select: { id: true },
  });

  if (!host) {
    const nextActive = await tx.player.findFirst({
      where: { gameId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const next =
      nextActive ??
      (await tx.player.findFirst({
        where: { gameId, status: "FINISHED" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }));
    if (next) {
      await tx.player.update({
        where: { id: next.id },
        data: { isHost: true },
      });
    }
  }

  const game = await tx.game.findUnique({
    where: { id: gameId },
    select: { status: true },
  });
  if (game?.status !== "ACTIVE") return;

  const activeCount = await tx.player.count({
    where: { gameId, status: "ACTIVE" },
  });
  if (activeCount > 0) return;

  await tx.game.update({
    where: { id: gameId },
    data: { status: "FINISHED", finishedAt: now },
  });
  await tx.joinRequest.updateMany({
    where: { gameId, status: "PENDING" },
    data: { status: "DENIED" },
  });
}

export async function markPlayerLeft(playerId: string): Promise<void> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, gameId: true, status: true },
  });
  if (!player || player.status === "LEFT") return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await lockGame(tx, player.gameId);
    const fresh = await tx.player.findUnique({ where: { id: playerId } });
    if (!fresh || fresh.status === "LEFT") return;
    await tx.player.update({
      where: { id: playerId },
      data: { status: "LEFT", leftAt: now, isHost: false },
    });
    await ensureHostAndMaybeFinish(tx, player.gameId, now);
  });
}

/** Refresh presence for a player who just contacted the server. Does not revive someone who already left. */
export async function touchPlayerPresence(playerId: string): Promise<void> {
  await prisma.player.updateMany({
    where: { id: playerId, status: { not: "LEFT" } },
    data: { lastSeenAt: new Date() },
  });
}

/**
 * Active players who closed the tab stop polling. After the grace period, mark
 * them left so the host role and end-of-game checks are not stuck on them.
 * `exceptPlayerId` is the player making this request (already touched).
 */
export async function reapStalePlayers(gameId: string, exceptPlayerId?: string): Promise<void> {
  const cutoff = new Date(Date.now() - presenceStaleMs());
  await prisma.$transaction(async (tx) => {
    await lockGame(tx, gameId);
    const game = await tx.game.findUnique({
      where: { id: gameId },
      select: { status: true },
    });
    if (!game || game.status === "FINISHED") return;

    const stale = await tx.player.findMany({
      where: {
        gameId,
        status: "ACTIVE",
        lastSeenAt: { lt: cutoff },
        ...(exceptPlayerId ? { id: { not: exceptPlayerId } } : {}),
      },
      select: { id: true },
    });
    if (stale.length === 0) return;

    const now = new Date();
    await tx.player.updateMany({
      where: { id: { in: stale.map((row) => row.id) }, status: "ACTIVE" },
      data: { status: "LEFT", leftAt: now, isHost: false },
    });
    await ensureHostAndMaybeFinish(tx, gameId, now);
  });
}
