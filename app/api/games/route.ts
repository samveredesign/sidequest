import { deleteGamesOlderThanSevenDays } from "@/lib/cleanup";
import { generateGameCodeWords } from "@/lib/game-code";
import { isAllowedDurationSeconds } from "@/lib/duration-options";
import { prisma } from "@/lib/prisma";
import { GameMode } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  playerName?: string;
  durationSeconds?: number;
  numberOfQuests?: number;
  mode?: GameMode;
  /** Secret Alliance: show partner names on the quest screen. */
  partnersKnown?: boolean;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.playerName?.trim();
  const durationSec = body.durationSeconds;
  const nQuests = body.numberOfQuests;
  const mode = body.mode;

  if (!name || name.length < 1) {
    return NextResponse.json({ error: "Player name required" }, { status: 400 });
  }
  if (typeof durationSec !== "number" || !isAllowedDurationSeconds(durationSec)) {
    return NextResponse.json({ error: "Invalid game duration" }, { status: 400 });
  }
  if (typeof nQuests !== "number" || nQuests < 1 || nQuests > 20) {
    return NextResponse.json({ error: "Number of quests must be 1–20" }, { status: 400 });
  }
  if (
    mode !== "FIRST_FINISH_WINS" &&
    mode !== "LAST_FINISH_LOSES" &&
    mode !== "SECRET_ALLIANCE"
  ) {
    return NextResponse.json({ error: "Invalid game mode" }, { status: 400 });
  }
  if (mode === "SECRET_ALLIANCE") {
    return NextResponse.json(
      { error: "Secret Alliance is temporarily unavailable." },
      { status: 400 },
    );
  }

  try {
    await deleteGamesOlderThanSevenDays();

    const { word1, word2 } = generateGameCodeWords();

    const game = await prisma.game.create({
      data: {
        codeWord1: word1,
        codeWord2: word2,
        durationSeconds: durationSec,
        numberOfQuests: nQuests,
        mode,
        partnersKnown: false,
        status: "LOBBY",
      },
    });

    const player = await prisma.player.create({
      data: {
        gameId: game.id,
        name,
        isHost: true,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      game: {
        id: game.id,
        codeWord1: game.codeWord1,
        codeWord2: game.codeWord2,
        status: game.status,
        mode: game.mode,
      },
      player: { id: player.id, name: player.name, isHost: player.isHost },
    });
  } catch (e) {
    console.error("[POST /api/games]", e);
    const msg = e instanceof Error ? e.message : String(e);
    const hints: string[] = [];
    if (/unknown argument|unknown field|does not exist/i.test(msg)) {
      hints.push("Run `npx prisma generate` and restart the dev server.");
    }
    if (/partnersKnown|allianceOnly|allianceGroup|slotIndex|no such column/i.test(msg)) {
      hints.push("Run `npx prisma migrate deploy` (or `npx prisma migrate dev`) then `npx prisma generate`.");
    }
    if (msg.includes("durationMinutes")) {
      hints.push("Run `npx prisma generate` and restart the dev server (Prisma client is out of date).");
    }
    const error =
      hints.length > 0
        ? `Could not create game. ${hints.join(" ")} (${msg})`
        : `Could not create game. (${msg})`;
    return NextResponse.json({ error }, { status: 500 });
  }
}
