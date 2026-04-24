"use client";

import { FullscreenLoadingOverlay } from "@/components/FullscreenLoadingOverlay";
import { GameHeader } from "@/components/GameHeader";
import { pathForGameSession } from "@/lib/routes";
import { clearLobbyBootstrap, peekLobbyBootstrap } from "@/lib/lobby-bootstrap";
import { markPlayBootstrap } from "@/lib/play-bootstrap";
import { readSession } from "@/lib/storage";
import type { GameStateJson } from "@/lib/game-state-types";
import { useGamePoll } from "@/hooks/useGamePoll";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const routeGameId = typeof params.gameId === "string" ? params.gameId : "";

  const [session, setSession] = useState<{ gameId: string; playerId: string } | null>(null);

  useEffect(() => {
    const { gameId, playerId } = readSession();
    if (!gameId || !playerId || gameId !== routeGameId) {
      router.replace("/");
      return;
    }
    setSession({ gameId, playerId });
  }, [routeGameId, router]);

  const { data, error, loading } = useGamePoll(session?.gameId ?? null, session?.playerId ?? null);

  useEffect(() => {
    if (!data || !session) return;
    if (peekLobbyBootstrap(session.gameId)) {
      clearLobbyBootstrap();
    }
    const state = data as GameStateJson;
    if (!state.me) {
      router.replace("/");
      return;
    }
    const next = pathForGameSession({ game: state.game, me: state.me });
    if (next && next !== pathname) {
      if (next.endsWith("/play")) {
        markPlayBootstrap(session.gameId);
      }
      router.replace(next);
    }
  }, [data, session, pathname, router]);

  if (!session) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  const { gameId, playerId } = session;

  const bootstrapping =
    !data && (loading || peekLobbyBootstrap(gameId));

  if (bootstrapping) {
    return <FullscreenLoadingOverlay label="Loading lobby…" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 py-8">
        <p className="text-red-600">{error ?? "Could not load game."}</p>
        <Link href="/" className="mt-4 text-sm underline">
          Home
        </Link>
      </div>
    );
  }

  const state = data as GameStateJson;

  if (state.game.status !== "LOBBY") {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-8">
      <GameHeader
        gameId={gameId}
        playerId={playerId}
        codeWord1={state.game.codeWord1}
        codeWord2={state.game.codeWord2}
        showCopyCode
      />
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Share this code with friends
      </p>
      <ul className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        {state.players.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</span>
            {p.isHost ? (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                Host
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {state.me?.isHost ? (
        <StartButton
          gameId={gameId}
          playerId={playerId}
          activePlayerCount={state.players.length}
          gameMode={state.game.mode}
        />
      ) : (
        <p className="text-center text-sm text-zinc-500">Waiting for host to start…</p>
      )}
    </div>
  );
}

function StartButton({
  gameId,
  playerId,
  activePlayerCount,
  gameMode,
}: {
  gameId: string;
  playerId: string;
  activePlayerCount: number;
  gameMode: string;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const secretAllianceMinPlayers = gameMode === "SECRET_ALLIANCE" && activePlayerCount < 4;

  async function start() {
    setErr(null);
    setPending(true);
    let navigated = false;
    try {
      const res = await fetch(`/api/games/${gameId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Could not start");
        return;
      }
      markPlayBootstrap(gameId);
      navigated = true;
      router.push(`/games/${gameId}/play`);
    } catch {
      setErr("Network error");
    } finally {
      if (!navigated) setPending(false);
    }
  }

  return (
    <div className="relative flex flex-col items-center gap-2">
      {pending ? <FullscreenLoadingOverlay label="Starting game…" /> : null}
      {secretAllianceMinPlayers ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Secret Alliance needs at least 4 players before you can start.
        </p>
      ) : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <button
        type="button"
        disabled={pending || secretAllianceMinPlayers}
        onClick={() => void start()}
        className="h-12 w-full max-w-xs rounded-lg bg-zinc-900 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Starting…" : "Start Game"}
      </button>
    </div>
  );
}
