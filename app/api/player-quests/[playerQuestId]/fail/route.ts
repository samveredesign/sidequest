import { ApiError } from "@/lib/api-error";
import { lockGame, lockPlayer } from "@/lib/db-lock";
import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { QUESTS_GRANTED_ON_FAIL } from "@/lib/game-rules";
import { errorResponse } from "@/lib/http";
import { requirePlayer } from "@/lib/player-auth";
import { prisma } from "@/lib/prisma";
import { pickRandomQuestIdsForPlayer } from "@/lib/quest-utils";
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
    const result = await prisma.$transaction(
      async (tx) => {
        await lockGame(tx, existing.player.gameId);
        await lockPlayer(tx, actor.id);

        const pq = await tx.playerQuest.findUnique({
          where: { id: playerQuestId },
          include: { player: true },
        });
        if (!pq || pq.playerId !== actor.id) throw new ApiError("Not found", 404);

        const game = await tx.game.findUnique({ where: { id: pq.player.gameId } });
        if (!game || game.status !== "ACTIVE") throw new ApiError("Game not active", 400);
        if (game.mode === "SECRET_ALLIANCE") {
          throw new ApiError("Failing quests is not available in Secret Alliance", 400);
        }
        if (pq.player.status !== "ACTIVE") throw new ApiError("Player not active", 400);

        const failLimit = game.maxFailsPerPlayer;
        const priorFails = await tx.playerQuest.count({
          where: { playerId: actor.id, status: "FAILED" },
        });
        if (pq.status !== "ACTIVE") {
          return {
            alreadyFailed: true,
            failsLeft: Math.max(0, failLimit - priorFails),
          };
        }
        if (priorFails >= failLimit) {
          throw new ApiError(
            failLimit <= 0
              ? "Failing quests is not allowed in this game."
              : `You've used all ${failLimit} fails for this game.`,
            400,
          );
        }

        const updated = await tx.playerQuest.updateMany({
          where: { id: playerQuestId, playerId: actor.id, status: "ACTIVE" },
          data: { status: "FAILED", failedAt: new Date() },
        });
        if (updated.count !== 1) {
          return {
            alreadyFailed: true,
            failsLeft: Math.max(0, failLimit - priorFails),
          };
        }

        await tx.player.update({
          where: { id: actor.id },
          data: { score: { decrement: 1 } },
        });

        const newIds = await pickRandomQuestIdsForPlayer(actor.id, QUESTS_GRANTED_ON_FAIL, {
          gameId: pq.player.gameId,
          tx,
        });
        await tx.playerQuest.createMany({
          data: newIds.map((questId) => ({
            playerId: actor.id,
            questId,
            status: "ACTIVE" as const,
          })),
        });

        const failsLeft = failLimit - (priorFails + 1);
        return { alreadyFailed: false, failsLeft };
      },
      { timeout: 20_000 },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
