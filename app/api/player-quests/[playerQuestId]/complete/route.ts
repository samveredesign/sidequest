import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ playerQuestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { playerQuestId } = await ctx.params;
  let body: { playerId?: string };
  try {
    body = (await req.json()) as { playerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const pq = await prisma.playerQuest.findUnique({
    where: { id: playerQuestId },
    include: { player: { include: { game: true } } },
  });

  if (!pq || pq.playerId !== body.playerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await expireGameIfTimeUp(pq.player.gameId);

  const game = await prisma.game.findUnique({ where: { id: pq.player.gameId } });
  if (!game || game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game not active" }, { status: 400 });
  }
  if (pq.player.status !== "ACTIVE") {
    return NextResponse.json({ error: "Player not active" }, { status: 400 });
  }
  if (pq.status !== "ACTIVE") {
    return NextResponse.json({ error: "Quest not active" }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.playerQuest.update({
      where: { id: playerQuestId },
      data: { status: "COMPLETED", completedAt: now },
    }),
    prisma.player.update({
      where: { id: body.playerId },
      data: { score: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
