import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ requestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { requestId } = await ctx.params;

  const reqRow = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    include: { game: true },
  });

  if (!reqRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  await expireGameIfTimeUp(reqRow.gameId);

  const reqFresh = await prisma.joinRequest.findUnique({
    where: { id: requestId },
  });
  if (!reqFresh) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const gameFresh = await prisma.game.findUnique({ where: { id: reqFresh.gameId } });
  if (!gameFresh) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (reqFresh.status === "PENDING") {
    if (gameFresh.status === "FINISHED") {
      return NextResponse.json({
        status: "DENIED",
        reason: "game_ended",
      });
    }
    return NextResponse.json({ status: "PENDING" });
  }

  if (reqFresh.status === "DENIED") {
    return NextResponse.json({ status: "DENIED", reason: "denied" });
  }

  const player = await prisma.player.findFirst({
    where: {
      gameId: reqFresh.gameId,
      name: reqFresh.playerName,
      status: { not: "LEFT" },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!player) {
    return NextResponse.json({
      status: "DENIED",
      reason: "missing_player",
    });
  }

  return NextResponse.json({
    status: "ACCEPTED",
    gameId: reqFresh.gameId,
    playerId: player.id,
  });
}
