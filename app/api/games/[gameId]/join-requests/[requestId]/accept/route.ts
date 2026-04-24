import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { isNameTakenInGame } from "@/lib/name-game";
import { assignQuestsToPlayer } from "@/lib/quest-utils";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string; requestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { gameId, requestId } = await ctx.params;
  let body: { hostPlayerId?: string };
  try {
    body = (await req.json()) as { hostPlayerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hostPlayerId = body.hostPlayerId;
  if (!hostPlayerId) {
    return NextResponse.json({ error: "hostPlayerId required" }, { status: 400 });
  }

  await expireGameIfTimeUp(gameId);

  const host = await prisma.player.findUnique({
    where: { id: hostPlayerId },
    include: { game: true },
  });

  if (!host || host.gameId !== gameId || !host.isHost || host.status === "LEFT") {
    return NextResponse.json({ error: "Only the host can accept" }, { status: 403 });
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game is not accepting joins" }, { status: 400 });
  }

  const joinReq = await prisma.joinRequest.findUnique({
    where: { id: requestId },
  });

  if (!joinReq || joinReq.gameId !== gameId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (joinReq.status !== "PENDING") {
    return NextResponse.json({ error: "Request already handled" }, { status: 400 });
  }

  if (await isNameTakenInGame(gameId, joinReq.playerName, { excludeJoinRequestId: requestId })) {
    return NextResponse.json(
      { error: "That name is already in the game" },
      { status: 409 },
    );
  }

  const player = await prisma.$transaction(async (tx) => {
    const p = await tx.player.create({
      data: {
        gameId,
        name: joinReq.playerName,
        isHost: false,
        status: "ACTIVE",
      },
    });
    await tx.joinRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
    });
    return p;
  });

  await assignQuestsToPlayer(player.id, game.numberOfQuests);

  return NextResponse.json({ ok: true, playerId: player.id });
}
