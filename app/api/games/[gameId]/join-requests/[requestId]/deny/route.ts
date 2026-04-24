import { expireGameIfTimeUp } from "@/lib/game-expiry";
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
  });

  if (!host || host.gameId !== gameId || !host.isHost || host.status === "LEFT") {
    return NextResponse.json({ error: "Only the host can deny" }, { status: 403 });
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

  await prisma.joinRequest.update({
    where: { id: requestId },
    data: { status: "DENIED" },
  });

  return NextResponse.json({ ok: true });
}
