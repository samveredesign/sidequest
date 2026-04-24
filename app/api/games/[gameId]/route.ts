import { buildGameState } from "@/lib/game-state";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId");

  const state = await buildGameState(gameId, playerId);
  if (!state) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(state);
}
