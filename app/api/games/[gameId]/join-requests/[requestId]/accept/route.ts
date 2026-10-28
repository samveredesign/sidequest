import { ApiError } from "@/lib/api-error";
import { lockGame, lockJoinRequest } from "@/lib/db-lock";
import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { errorResponse } from "@/lib/http";
import { isNameTakenInGame } from "@/lib/name-game";
import { requirePlayer } from "@/lib/player-auth";
import { prisma } from "@/lib/prisma";
import { assignQuestsToPlayer } from "@/lib/quest-utils";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string; requestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { gameId, requestId } = await ctx.params;
  const auth = await requirePlayer(req, { gameId });
  if ("response" in auth) return auth.response;

  await expireGameIfTimeUp(gameId);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await lockGame(tx, gameId);
        await lockJoinRequest(tx, requestId);

        const host = await tx.player.findUnique({ where: { id: auth.player.id } });
        if (!host || host.gameId !== gameId || !host.isHost || host.status === "LEFT") {
          throw new ApiError("Only the host can accept", 403);
        }

        const game = await tx.game.findUnique({ where: { id: gameId } });
        if (!game || game.status !== "ACTIVE") {
          throw new ApiError("Game is not accepting joins", 400);
        }

        const joinReq = await tx.joinRequest.findUnique({ where: { id: requestId } });
        if (!joinReq || joinReq.gameId !== gameId) throw new ApiError("Request not found", 404);

        if (joinReq.status === "ACCEPTED") {
          const existing = await tx.player.findFirst({
            where: { gameId, secretToken: joinReq.playerToken },
            select: { id: true },
          });
          return { ok: true as const, alreadyAccepted: true, playerId: existing?.id ?? null };
        }
        if (joinReq.status !== "PENDING") {
          throw new ApiError("Request already handled", 409);
        }

        if (await isNameTakenInGame(gameId, joinReq.playerName, { excludeJoinRequestId: requestId, tx })) {
          throw new ApiError("That name is already in the game", 409);
        }

        const claimed = await tx.joinRequest.updateMany({
          where: { id: requestId, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });
        if (claimed.count !== 1) {
          throw new ApiError("Request already handled", 409);
        }

        const player = await tx.player.create({
          data: {
            gameId,
            name: joinReq.playerName,
            isHost: false,
            status: "ACTIVE",
            secretToken: joinReq.playerToken,
          },
        });
        await assignQuestsToPlayer(player.id, game.numberOfQuests, tx);
        return { ok: true as const, alreadyAccepted: false, playerId: player.id };
      },
      { timeout: 20_000 },
    );

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
