import { ApiError } from "@/lib/api-error";
import { lockGame, lockJoinRequest } from "@/lib/db-lock";
import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { errorResponse } from "@/lib/http";
import { requirePlayer } from "@/lib/player-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string; requestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { gameId, requestId } = await ctx.params;
  const auth = await requirePlayer(req, { gameId });
  if ("response" in auth) return auth.response;

  await expireGameIfTimeUp(gameId);

  try {
    await prisma.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      await lockJoinRequest(tx, requestId);

      const host = await tx.player.findUnique({ where: { id: auth.player.id } });
      if (!host || host.gameId !== gameId || !host.isHost || host.status === "LEFT") {
        throw new ApiError("Only the host can deny", 403);
      }

      const joinReq = await tx.joinRequest.findUnique({ where: { id: requestId } });
      if (!joinReq || joinReq.gameId !== gameId) throw new ApiError("Request not found", 404);
      if (joinReq.status === "DENIED") return;
      if (joinReq.status !== "PENDING") throw new ApiError("Request already handled", 409);

      const claimed = await tx.joinRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "DENIED" },
      });
      if (claimed.count !== 1) throw new ApiError("Request already handled", 409);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
