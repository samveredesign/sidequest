import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { hostPlayerId?: string } | null;
  const hostPlayerId = body?.hostPlayerId;

  if (!hostPlayerId) {
    return NextResponse.json({ error: "hostPlayerId is required" }, { status: 400 });
  }

  const host = await prisma.player.findUnique({
    where: { id: hostPlayerId },
    include: { game: true },
  });

  if (!host || host.gameId !== gameId) {
    return NextResponse.json({ error: "Host player not found in this game" }, { status: 404 });
  }
  if (!host.isHost || host.status === "LEFT") {
    return NextResponse.json({ error: "Only an active host can end the game" }, { status: 403 });
  }
  if (host.game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game is not active" }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.game.update({
      where: { id: gameId },
      data: { status: "FINISHED", finishedAt: now },
    }),
    prisma.joinRequest.updateMany({
      where: { gameId, status: "PENDING" },
      data: { status: "DENIED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
