import { ApiError } from "@/lib/api-error";
import { lockGame } from "@/lib/db-lock";
import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { ensureHostAndMaybeFinish } from "@/lib/game-lifecycle";
import { errorResponse } from "@/lib/http";
import { requirePlayer } from "@/lib/player-auth";
import { prisma } from "@/lib/prisma";
import { canAllianceSubmit } from "@/lib/secret-alliance";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ playerId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;
  const auth = await requirePlayer(req, { playerId });
  if ("response" in auth) return auth.response;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { gameId: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  await expireGameIfTimeUp(player.gameId);

  try {
    await prisma.$transaction(async (tx) => {
      await lockGame(tx, player.gameId);
      const fresh = await tx.player.findUnique({ where: { id: playerId } });
      if (!fresh) throw new ApiError("Player not found", 404);
      if (fresh.status === "LEFT") throw new ApiError("Player left", 400);
      if (fresh.status === "FINISHED") return;

      const game = await tx.game.findUnique({ where: { id: fresh.gameId } });
      if (!game || game.status !== "ACTIVE") throw new ApiError("Game not active", 400);

      const activeLeft = await tx.playerQuest.count({
        where: { playerId, status: "ACTIVE" },
      });

      if (game.mode === "SECRET_ALLIANCE") {
        if (!(await canAllianceSubmit(tx, playerId))) {
          throw new ApiError(
            "Your alliance must complete every quest (you and every partner) before anyone can submit.",
            400,
          );
        }
      } else if (activeLeft > 0) {
        throw new ApiError("Still have active quests", 400);
      }

      const totalQuests = await tx.playerQuest.count({ where: { playerId } });
      if (totalQuests === 0) throw new ApiError("No quests assigned", 400);

      const now = new Date();
      if (game.mode === "SECRET_ALLIANCE") {
        if (fresh.allianceGroup == null) return;
        const allies = await tx.player.findMany({
          where: {
            gameId: fresh.gameId,
            allianceGroup: fresh.allianceGroup,
            status: "ACTIVE",
          },
        });
        for (const ally of allies) {
          await tx.player.updateMany({
            where: { id: ally.id, status: "ACTIVE" },
            data: { status: "FINISHED", finishedAt: now },
          });
        }
      } else {
        const finished = await tx.player.updateMany({
          where: { id: playerId, status: "ACTIVE" },
          data: { status: "FINISHED", finishedAt: now },
        });
        if (finished.count !== 1) return;
      }

      if (game.mode === "FIRST_FINISH_WINS" || game.mode === "SECRET_ALLIANCE") {
        const claimed = await tx.game.updateMany({
          where: { id: game.id, status: "ACTIVE" },
          data: { status: "FINISHED", finishedAt: now },
        });
        if (claimed.count === 1) {
          await tx.joinRequest.updateMany({
            where: { gameId: game.id, status: "PENDING" },
            data: { status: "DENIED" },
          });
        }
        return;
      }

      await ensureHostAndMaybeFinish(tx, game.id, now);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
