import { errorResponse } from "@/lib/http";
import { markPlayerLeft } from "@/lib/game-lifecycle";
import { requirePlayer } from "@/lib/player-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ playerId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;
  const auth = await requirePlayer(req, { playerId });
  if ("response" in auth) return auth.response;

  try {
    await markPlayerLeft(playerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
