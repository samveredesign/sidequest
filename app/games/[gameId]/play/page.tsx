"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { FullscreenLoadingOverlay } from "@/components/FullscreenLoadingOverlay";
import { GameHeader } from "@/components/GameHeader";
import { HostJoinRequestModal } from "@/components/HostJoinRequestModal";
import { QuestText } from "@/components/QuestText";
import type { GameStateJson } from "@/lib/game-state-types";
import { formatFailsLeft } from "@/lib/game-rules";
import { clearPlayBootstrap, peekPlayBootstrap } from "@/lib/play-bootstrap";
import { useGamePoll } from "@/hooks/useGamePoll";
import { authHeaders, readSession } from "@/lib/storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TimeRemaining({
  endsAt,
  gameStatus,
}: {
  endsAt: string | null;
  gameStatus: string;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (gameStatus !== "ACTIVE" || !endsAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [endsAt, gameStatus]);

  if (gameStatus !== "ACTIVE" || !endsAt) {
    return <span className="text-lg font-mono text-zinc-400">—</span>;
  }

  const ms = new Date(endsAt).getTime() - Date.now();
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return <span className="text-lg font-mono font-semibold tabular-nums">{formatTimeRemaining(sec)}</span>;
}

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const routeGameId = typeof params.gameId === "string" ? params.gameId : "";

  const [session, setSession] = useState<{ gameId: string; playerId: string; token: string } | null>(null);
  const [failQuestId, setFailQuestId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | { kind: "complete" | "fail" | "submit"; id?: string }>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [failNotice, setFailNotice] = useState<string | null>(null);
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [peerNotice, setPeerNotice] = useState<{ id: string; name: string } | null>(null);
  const prevFinishedIdsRef = useRef<Set<string>>(new Set());
  const peerTrackReadyRef = useRef(false);
  useEffect(() => {
    const { gameId, playerId, token } = readSession();
    if (!gameId || !playerId || !token || gameId !== routeGameId) {
      router.replace("/");
      return;
    }
    setSession({ gameId, playerId, token });
  }, [routeGameId, router]);

  const { data, error, loading, refresh } = useGamePoll(
    session?.gameId ?? null,
    session?.token ?? null,
  );

  useEffect(() => {
    if (!data || !session) return;
    if (peekPlayBootstrap(session.gameId)) {
      clearPlayBootstrap();
    }
  }, [data, session]);

  useEffect(() => {
    if (!data || !session) return;
    const state = data as GameStateJson;
    if (!state.me) {
      router.replace("/");
      return;
    }
    if (state.game.status === "LOBBY") {
      router.replace(`/games/${session.gameId}/lobby`);
    }
  }, [data, session, router]);

  useEffect(() => {
    if (!data) return;
    const state = data as GameStateJson;
    setGameOverOpen(state.game.status === "FINISHED");
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const state = data as GameStateJson;
    const trackPeers =
      state.game.mode === "LAST_FINISH_LOSES" &&
      state.game.status === "ACTIVE" &&
      state.me?.status === "ACTIVE";

    if (!trackPeers) {
      peerTrackReadyRef.current = false;
      prevFinishedIdsRef.current = new Set();
      setPeerNotice(null);
      return;
    }

    const finishedIds = new Set(
      state.players.filter((p) => p.status === "FINISHED").map((p) => p.id),
    );

    if (!peerTrackReadyRef.current) {
      peerTrackReadyRef.current = true;
      prevFinishedIdsRef.current = finishedIds;
      return;
    }

    const prev = prevFinishedIdsRef.current;
    for (const id of finishedIds) {
      if (prev.has(id) || id === state.me?.id) continue;
      const pl = state.players.find((p) => p.id === id);
      if (pl) {
        setPeerNotice({ id: pl.id, name: pl.name });
        prevFinishedIdsRef.current = new Set(prev).add(id);
        return;
      }
    }
    prevFinishedIdsRef.current = new Set(finishedIds);
  }, [data]);

  if (!session) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  const { gameId, playerId, token } = session;

  const bootstrapping = !data && (loading || peekPlayBootstrap(gameId));

  if (bootstrapping) {
    return <FullscreenLoadingOverlay label="Loading quests…" />;
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

  if (state.game.status === "LOBBY") {
    return null;
  }

  const quests = state.myQuests ?? [];
  const failsRemaining = state.me?.failsRemaining ?? 0;
  const outOfFails = state.game.mode !== "SECRET_ALLIANCE" && failsRemaining <= 0;
  const actionsLocked = busy !== null;

  async function completeQuest(pqId: string) {
    if (busy) return;
    setBusy({ kind: "complete", id: pqId });
    setActionError(null);
    try {
      const res = await fetch(`/api/player-quests/${pqId}/complete`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(body.error ?? "Could not complete that quest.");
        return;
      }
    } catch {
      setActionError("Network error — the quest was not completed.");
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  async function failQuest(pqId: string) {
    if (busy) return;
    setBusy({ kind: "fail", id: pqId });
    setActionError(null);
    try {
      const res = await fetch(`/api/player-quests/${pqId}/fail`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        failsLeft?: number;
        alreadyFailed?: boolean;
      };
      if (!res.ok) {
        setActionError(body.error ?? "Could not fail that quest.");
        return;
      }
      if (!body.alreadyFailed && typeof body.failsLeft === "number") {
        setFailNotice(formatFailsLeft(body.failsLeft));
      }
      setFailQuestId(null);
    } catch {
      setActionError("Network error — the quest was not failed.");
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  async function submitAll() {
    if (busy) return;
    setBusy({ kind: "submit" });
    setActionError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/submit`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(body.error ?? "Could not submit your quests.");
        return;
      }
      void refresh();
      router.push(`/games/${gameId}/leaderboard`);
    } catch {
      setActionError("Network error — your quests were not submitted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-8">
      <GameHeader
        gameId={gameId}
        playerId={playerId}
        token={token}
        codeWord1={state.game.codeWord1}
        codeWord2={state.game.codeWord2}
        canEndGame={state.me?.isHost === true && state.game.status === "ACTIVE"}
      />

      {failNotice ? (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950"
        >
          Quest failed. {failNotice}.
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      {state.alliance ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/35">
          {state.alliance.partnersKnown ? (
            <>
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                You are in a secret alliance with:
              </p>
              <p className="mt-1 text-sm text-violet-800 dark:text-violet-200">
                {state.alliance.partnerNames.length > 0
                  ? state.alliance.partnerNames.join(", ")
                  : "—"}
              </p>
            </>
          ) : (
            <p className="text-sm text-violet-900 dark:text-violet-100">
              You are in a secret alliance with someone - discover their identity and complete your quests
              together. Don&apos;t blow your cover!
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-row items-start justify-between gap-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Your score</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{state.me?.score ?? 0}</p>
          {state.game.mode !== "SECRET_ALLIANCE" ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {failsRemaining === 0 ? "No fails left" : formatFailsLeft(failsRemaining)}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Time remaining</p>
          <TimeRemaining endsAt={state.game.endsAt} gameStatus={state.game.status} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Quests</h2>
        {outOfFails ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Fail is unavailable — you have used all 5 fails this game.
          </p>
        ) : null}
        {quests.length === 0 ? (
          <p className="text-sm text-zinc-500">No quests loaded yet.</p>
        ) : (
          quests.map((q) => (
            <div
              key={q.id}
              className={`rounded-lg border p-4 ${
                q.status === "COMPLETED" && q.allianceNeedsPartner
                  ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                  : q.status === "COMPLETED"
                    ? "border-green-600 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
                    : q.status === "FAILED"
                      ? "border-red-600 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                      : "border-zinc-200 dark:border-zinc-700"
              }`}
            >
              <QuestText
                text={q.text}
                className="text-sm text-zinc-900 dark:text-zinc-50"
              />
              {q.allianceNeedsPartner ? (
                <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                  Waiting for your partner(s) to complete this quest — it only counts when everyone in your
                  alliance has marked it done.
                </p>
              ) : null}
              {q.status === "ACTIVE" && state.game.status === "ACTIVE" && state.me?.status === "ACTIVE" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={actionsLocked}
                    aria-busy={busy?.kind === "complete" && busy.id === q.id}
                    onClick={() => void completeQuest(q.id)}
                    className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    {busy?.kind === "complete" && busy.id === q.id ? "Completing…" : "Complete"}
                  </button>
                  {state.game.mode !== "SECRET_ALLIANCE" ? (
                    <button
                      type="button"
                      disabled={actionsLocked || outOfFails}
                      aria-busy={busy?.kind === "fail" && busy.id === q.id}
                      onClick={() => setFailQuestId(q.id)}
                      className="rounded-md border border-red-400 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      {busy?.kind === "fail" && busy.id === q.id ? "Failing…" : "Fail"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {state.canSubmit && state.game.status === "ACTIVE" && state.me?.status === "ACTIVE" ? (
        <button
          type="button"
          disabled={actionsLocked}
          aria-busy={busy?.kind === "submit"}
          onClick={() => void submitAll()}
          className="h-12 rounded-lg bg-zinc-900 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy?.kind === "submit" ? "Submitting…" : "Submit Quests"}
        </button>
      ) : null}

      <ConfirmModal
        open={failQuestId !== null}
        title="Fail Quest?"
        message={`Failing this quest will give you -1 point and add 2 new quests. You will have ${formatFailsLeft(Math.max(0, failsRemaining - 1))} after this.`}
        confirmLabel={busy?.kind === "fail" ? "Failing…" : "Fail Quest"}
        busy={busy?.kind === "fail"}
        onCancel={() => {
          if (busy?.kind === "fail") return;
          setFailQuestId(null);
        }}
        onConfirm={() => {
          if (failQuestId) void failQuest(failQuestId);
        }}
      />

      <ConfirmModal
        open={gameOverOpen}
        title="Game Over"
        message="The game has ended."
        confirmLabel="View Leaderboard"
        cancelLabel={null}
        onCancel={() => setGameOverOpen(false)}
        onConfirm={() => {
          setGameOverOpen(false);
          router.push(`/games/${gameId}/leaderboard`);
        }}
      />

      {peerNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="peer-finish-title"
          >
            <h2
              id="peer-finish-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Player finished
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {peerNotice.name}
              </span>{" "}
              has completed their side quests.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setPeerNotice(null);
                  router.push(`/games/${gameId}/completed/${peerNotice.id}`);
                }}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                View completed quests
              </button>
              <button
                type="button"
                onClick={() => setPeerNotice(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Return to game
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <HostJoinRequestModal
        gameId={gameId}
        token={token}
        enabled={state.me?.isHost === true && state.game.status === "ACTIVE"}
        requests={state.pendingJoinRequests ?? []}
        onChanged={() => void refresh()}
      />
    </div>
  );
}
