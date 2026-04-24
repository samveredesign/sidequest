import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ playerId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { game: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (player.status === "LEFT") {
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const wasHost = player.isHost;
  const gameLobby = player.game.status === "LOBBY";

  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: playerId },
      data: {
        status: "LEFT",
        leftAt: now,
        isHost: false,
      },
    });

    if (wasHost && gameLobby) {
      const nextHost = await tx.player.findFirst({
        where: {
          gameId: player.gameId,
          id: { not: playerId },
          status: { not: "LEFT" },
        },
        orderBy: { createdAt: "asc" },
      });
      if (nextHost) {
        await tx.player.update({
          where: { id: nextHost.id },
          data: { isHost: true },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
