import { ApiError } from "@/lib/api-error";
import { lockGame, lockPlayer } from "@/lib/db-lock";
import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { errorResponse } from "@/lib/http";
import { requirePlayer } from "@/lib/player-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ playerQuestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { playerQuestId } = await ctx.params;
  const auth = await requirePlayer(req);
  if ("response" in auth) return auth.response;
  const actor = auth.player;

  const existing = await prisma.playerQuest.findUnique({
    where: { id: playerQuestId },
    select: { id: true, playerId: true, player: { select: { gameId: true } } },
  });
  if (!existing || existing.playerId !== actor.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await expireGameIfTimeUp(existing.player.gameId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockGame(tx, existing.player.gameId);
      await lockPlayer(tx, actor.id);
      const pq = await tx.playerQuest.findUnique({
        where: { id: playerQuestId },
        include: { player: true },
      });
      if (!pq || pq.playerId !== actor.id) throw new ApiError("Not found", 404);

      const game = await tx.game.findUnique({ where: { id: pq.player.gameId } });
      if (!game || game.status !== "ACTIVE") throw new ApiError("Game not active", 400);
      if (pq.player.status !== "ACTIVE") throw new ApiError("Player not active", 400);

      const updated = await tx.playerQuest.updateMany({
        where: { id: playerQuestId, playerId: actor.id, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (updated.count !== 1) {
        return { alreadyCompleted: true };
      }
      await tx.player.update({
        where: { id: actor.id },
        data: { score: { increment: 1 } },
      });
      return { alreadyCompleted: false };
    });

    return NextResponse.json({ ok: true, alreadyCompleted: result.alreadyCompleted });
  } catch (error) {
    return errorResponse(error);
  }
}
