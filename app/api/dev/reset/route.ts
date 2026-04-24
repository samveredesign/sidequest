import { QUEST_POOL } from "@/data/quest-pool";
import { SECRET_ALLIANCE_QUEST_POOL } from "@/data/secret-alliance-quest-pool";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Clears dev data and rebuilds the global quest catalog from `quest-pool.ts`
 * (runtime always reads quests from the DB, not from the TS files).
 */
export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.playerQuest.deleteMany();
  await prisma.player.deleteMany();
  await prisma.game.deleteMany();

  await prisma.quest.deleteMany();

  await prisma.quest.createMany({
    data: [
      ...QUEST_POOL.map((text) => ({ text, allianceOnly: false })),
      ...SECRET_ALLIANCE_QUEST_POOL.map((text) => ({ text, allianceOnly: true })),
    ],
  });

  return NextResponse.json({
    ok: true,
    questsSeeded: QUEST_POOL.length + SECRET_ALLIANCE_QUEST_POOL.length,
  });
}
