import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ gameId: string; otherPlayerId: string }>;
};

export async function GET(req: Request, ctx: Ctx) {
  const { gameId, otherPlayerId } = await ctx.params;
  const url = new URL(req.url);
  const viewerId = url.searchParams.get("viewerId");

  if (!viewerId) {
    return NextResponse.json({ error: "viewerId required" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const viewer = game.players.find((p) => p.id === viewerId);
  const target = game.players.find((p) => p.id === otherPlayerId);

  if (!viewer || !target) {
    return NextResponse.json({ error: "Player not in game" }, { status: 404 });
  }

  const canReveal =
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
    quests: rows.map((r) => ({
      text: r.quest.text,
      status: r.status,
    })),
  });
}
