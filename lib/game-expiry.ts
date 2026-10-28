import { prisma } from "@/lib/prisma";

/**
 * If the round timer has elapsed, marks the game FINISHED and denies pending join requests.
 * Call from game state / mutations so all clients converge on the next poll.
 */
export async function expireGameIfTimeUp(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.status !== "ACTIVE" || !game.startedAt) return;

  const endMs = game.startedAt.getTime() + game.durationSeconds * 1000;
  if (Date.now() < endMs) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.game.updateMany({
      where: { id: gameId, status: "ACTIVE" },
      data: { status: "FINISHED", finishedAt: now },
    });
    if (claimed.count !== 1) return;
    await tx.joinRequest.updateMany({
      where: { gameId, status: "PENDING" },
      data: { status: "DENIED" },
    });
  });
}
