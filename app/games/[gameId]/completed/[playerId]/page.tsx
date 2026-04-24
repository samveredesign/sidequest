"use client";

import { GameHeader } from "@/components/GameHeader";
import { QuestText } from "@/components/QuestText";
import type { GameStateJson } from "@/lib/game-state-types";
import { useGamePoll } from "@/hooks/useGamePoll";
import { readSession } from "@/lib/storage";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type QuestRow = { text: string; status: string };

export default function ViewCompletedQuestsPage() {
  const params = useParams();
  const router = useRouter();
  const routeGameId = typeof params.gameId === "string" ? params.gameId : "";
  const targetPlayerId = typeof params.playerId === "string" ? params.playerId : "";

  const [session, setSession] = useState<{ gameId: string; playerId: string } | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [quests, setQuests] = useState<QuestRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { gameId, playerId } = readSession();
    if (!gameId || !playerId || gameId !== routeGameId) {
      router.replace("/");
      return;
    }
    setSession({ gameId, playerId });
  }, [routeGameId, router]);

  const { data: gameData } = useGamePoll(session?.gameId ?? null, session?.playerId ?? null);
  const gameState = gameData as GameStateJson | undefined;

  useEffect(() => {
    if (!session || !targetPlayerId) return;
    let cancelled = false;
    setErr(null);
    setQuests(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/games/${session.gameId}/players/${targetPlayerId}/quests?viewerId=${encodeURIComponent(session.playerId)}`,
        );
        const j = (await res.json()) as {
          error?: string;
          playerName?: string;
          quests?: QuestRow[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setErr(j.error ?? "Could not load quests");
          return;
        }
        setPlayerName(j.playerName ?? "");
        setQuests(j.quests ?? []);
      } catch {
        if (!cancelled) setErr("Network error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, targetPlayerId]);

  if (!session) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  const { gameId, playerId } = session;

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-8">
      <GameHeader
        gameId={gameId}
        playerId={playerId}
        codeWord1={gameState?.game.codeWord1 ?? ""}
        codeWord2={gameState?.game.codeWord2 ?? ""}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/games/${gameId}/play`)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Return to game
        </button>
      </div>

      <h1 className="text-xl font-normal text-zinc-900 dark:text-zinc-50">
        {playerName ? `${playerName}’s quests` : "Completed quests"}
      </h1>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {quests === null && !err ? (
        <p className="text-sm text-zinc-500">Loading quests…</p>
      ) : null}

      {quests && quests.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {quests.map((q, i) => (
            <li
              key={i}
              className={`rounded-lg border p-3 text-sm ${
                q.status === "COMPLETED"
                  ? "border-green-600 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                  : q.status === "FAILED"
                    ? "border-red-500 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                    : "border-zinc-200 dark:border-zinc-700"
              }`}
            >
              <QuestText
                text={q.text}
                inline
                className="text-zinc-800 dark:text-zinc-200"
              />
              <span className="ml-2 text-xs text-zinc-500">({q.status})</span>
            </li>
          ))}
        </ul>
      ) : null}

      {quests && quests.length === 0 && !err ? (
        <p className="text-sm text-zinc-500">No quests to show.</p>
      ) : null}
    </div>
  );
}
