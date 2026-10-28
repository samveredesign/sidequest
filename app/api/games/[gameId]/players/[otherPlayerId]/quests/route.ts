import { requirePlayer } from "@/lib/player-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ gameId: string; otherPlayerId: string }>;
};

export async function GET(req: Request, ctx: Ctx) {
  const { gameId, otherPlayerId } = await ctx.params;
  const auth = await requirePlayer(req, { gameId });
  if ("response" in auth) return auth.response;
  const viewer = auth.player;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const target = game.players.find((player) => player.id === otherPlayerId);
  if (!target) {
    return NextResponse.json({ error: "Player not in game" }, { status: 404 });
  }

  const canReveal =
    viewer.id === target.id ||
    game.status === "FINISHED" ||
    viewer.status === "FINISHED" ||
    viewer.status === "LEFT" ||
    (game.status === "ACTIVE" &&
      game.mode === "LAST_FINISH_LOSES" &&
      viewer.status === "ACTIVE" &&
      target.status === "FINISHED");

  if (!canReveal) {
    return NextResponse.json({ error: "Cannot view yet" }, { status: 403 });
  }

  const rows = await prisma.playerQuest.findMany({
    where: { playerId: otherPlayerId },
    include: { quest: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    playerName: target.name,
    quests: rows.map((row) => ({
      text: row.quest.text,
      status: row.status,
    })),
  });
}
