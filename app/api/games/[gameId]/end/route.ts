import { ApiError } from "@/lib/api-error";
import { lockGame } from "@/lib/db-lock";
import { errorResponse } from "@/lib/http";
import { requirePlayer } from "@/lib/player-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  const auth = await requirePlayer(req, { gameId });
  if ("response" in auth) return auth.response;

  try {
    await prisma.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      const host = await tx.player.findUnique({ where: { id: auth.player.id } });
      if (!host || host.gameId !== gameId) {
        throw new ApiError("Host player not found in this game", 404);
      }
      if (!host.isHost || host.status === "LEFT") {
        throw new ApiError("Only an active host can end the game", 403);
      }
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (game?.status === "FINISHED") return;
      if (!game || game.status !== "ACTIVE") {
        throw new ApiError("Game is not active", 400);
      }
      const now = new Date();
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
