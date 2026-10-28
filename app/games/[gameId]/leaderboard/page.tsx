"use client";

import { GameHeader } from "@/components/GameHeader";
import { HostJoinRequestModal } from "@/components/HostJoinRequestModal";
import { QuestText } from "@/components/QuestText";
import { formatFinishDuration } from "@/lib/finish-duration";
import { rankTitleForPlayer } from "@/lib/leaderboard-ranks";
import { sortLeaderboardPlayers } from "@/lib/leaderboard-order";
import { canViewLeaderboard } from "@/lib/routes";
import { authHeaders, readSession } from "@/lib/storage";
import type { GameStateJson } from "@/lib/game-state-types";
import { useGamePoll } from "@/hooks/useGamePoll";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

type QuestReveal = { text: string; status: string };

export default function LeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const routeGameId = typeof params.gameId === "string" ? params.gameId : "";

  const [session, setSession] = useState<{ gameId: string; playerId: string; token: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedTeamGroup, setExpandedTeamGroup] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, QuestReveal[]>>({});
  const [revealErr, setRevealErr] = useState<string | null>(null);

  useEffect(() => {
    const { gameId, playerId, token } = readSession();
    if (!gameId || !playerId || !token || gameId !== routeGameId) {
      router.replace("/");
      return;
    }
    setSession({ gameId, playerId, token });
  }, [routeGameId, router]);

  const { data, error, loading, refresh } = useGamePoll(session?.gameId ?? null, session?.token ?? null);

  useEffect(() => {
    if (!data || !session) return;
    const state = data as GameStateJson;
    if (!state.me) {
      router.replace("/");
      return;
    }
    if (state.game.status === "LOBBY") {
      router.replace(`/games/${session.gameId}/lobby`);
      return;
    }
    if (!canViewLeaderboard(state)) {
      router.replace(`/games/${session.gameId}/play`);
    }
  }, [data, session, router]);

  async function toggleReveal(targetId: string) {
    if (!session) return;
    if (expanded === targetId) {
      setExpanded(null);
      return;
    }
    setRevealErr(null);
    if (!revealed[targetId]) {
      try {
        const res = await fetch(`/api/games/${session.gameId}/players/${targetId}/quests`, {
          headers: authHeaders(session.token),
        });
        const j = (await res.json()) as { error?: string; quests?: QuestReveal[]; playerName?: string };
        if (!res.ok) {
          setRevealErr(j.error ?? "Could not load quests");
          return;
        }
        setRevealed((r) => ({ ...r, [targetId]: j.quests ?? [] }));
      } catch {
        setRevealErr("Network error");
        return;
      }
    }
    setExpanded(targetId);
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  const { gameId, playerId, token } = session;

  if (loading && !data) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Loading leaderboard…</p>
      </div>
    );
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
  const board = state.leaderboardPlayers ?? state.players;
  const sorted = sortLeaderboardPlayers(
    state.game.mode,
    state.game.status,
    board.map((player) => ({
      ...player,
      completedQuests: player.completedQuests ?? 0,
    })),
  );
  const startedAt = state.game.startedAt;
  const teams = state.leaderboardTeams;
  const isTeamBoard =
    state.game.mode === "SECRET_ALLIANCE" && teams != null && teams.length > 0;

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

      <h1 className="text-xl font-normal text-zinc-900 dark:text-zinc-50">Leaderboard</h1>

      {state.outcome?.winnerName ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          {state.outcome.winnerName} won — first to finish.
        </p>
      ) : null}
      {state.outcome?.loserName ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          {state.outcome.loserName} lost — least progress
          {state.outcome.loserCompletedQuests != null
            ? ` (${state.outcome.loserCompletedQuests} quest${state.outcome.loserCompletedQuests === 1 ? "" : "s"} completed).`
            : "."}
        </p>
      ) : null}

      {state.game.mode === "LAST_FINISH_LOSES" && state.game.status === "ACTIVE" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Only players who have completed their side quests are listed. Others are still playing.
        </p>
      ) : null}

      {revealErr ? <p className="text-sm text-red-600">{revealErr}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-900 bg-zinc-900 text-zinc-100 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
            <tr>
              <th className="border border-zinc-200 p-3 font-medium">{isTeamBoard ? "Alliance" : "Name"}</th>
              <th className="border border-zinc-200 p-3 font-medium">Score</th>
              <th className="border border-zinc-200 p-3 font-medium">Finished</th>
              <th className="border border-zinc-200 p-3 font-medium">Rank</th>
            </tr>
          </thead>
          <tbody>
            {isTeamBoard
              ? teams!.map((team, index) => (
                  <Fragment key={team.groupId}>
                    <tr
                      className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                      onClick={() =>
                        setExpandedTeamGroup((g) => (g === team.groupId ? null : team.groupId))
                      }
                    >
                      <td className="p-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {team.memberNames.join(" · ")}
                      </td>
                      <td className="p-3">{team.totalScore}</td>
                      <td className="p-3 text-zinc-600 dark:text-zinc-400">
                        {formatFinishDuration(startedAt, team.finishedAt)}
                      </td>
                      <td
                        className={`p-3 ${
                          index === 0
                            ? "text-amber-500 dark:text-amber-400"
                            : index === 1
                              ? "text-zinc-500 dark:text-zinc-300"
                              : index === 2
                                ? "text-orange-700 dark:text-orange-400"
                                : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <span className="tabular-nums">{index + 1}.</span>{" "}
                        {rankTitleForPlayer(
                          state.game.id,
                          [...team.memberIds].sort().join(":"),
                          index,
                        )}
                      </td>
                    </tr>
                    {expandedTeamGroup === team.groupId ? (
                      <tr className="bg-zinc-50 dark:bg-zinc-900/30">
                        <td colSpan={4} className="p-4">
                          <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
                            Member quests
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {team.memberIds.map((mid, i) => (
                              <button
                                key={mid}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTeamGroup(team.groupId);
                                  void toggleReveal(mid);
                                }}
                                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                {team.memberNames[i]}
                              </button>
                            ))}
                          </div>
                          {expanded && team.memberIds.includes(expanded) ? (
                            <ul className="mt-4 flex flex-col gap-2">
                              {(revealed[expanded] ?? []).map((q, i) => (
                                <li
                                  key={i}
                                  className={`rounded border p-2 text-sm ${
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
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              : sorted.map((p, index) => (
                  <Fragment key={p.id}>
                    <tr
                      className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                      onClick={() => void toggleReveal(p.id)}
                    >
                      <td className="p-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {p.name}
                        {p.id === state.outcome?.winnerId ? (
                          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            Winner
                          </span>
                        ) : null}
                        {p.id === state.outcome?.loserId ? (
                          <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
                            Lost
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3">{p.score}</td>
                      <td className="p-3 text-zinc-600 dark:text-zinc-400">
                        {formatFinishDuration(startedAt, p.finishedAt)}
                      </td>
                      <td
                        className={`p-3 ${
                          index === 0
                            ? "text-amber-500 dark:text-amber-400"
                            : index === 1
                              ? "text-zinc-500 dark:text-zinc-300"
                              : index === 2
                                ? "text-orange-700 dark:text-orange-400"
                                : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <span className="tabular-nums">{index + 1}.</span>{" "}
                        {rankTitleForPlayer(state.game.id, p.id, index)}
                      </td>
                    </tr>
                    {expanded === p.id ? (
                      <tr className="bg-zinc-50 dark:bg-zinc-900/30">
                        <td colSpan={4} className="p-4">
                          <p className="mb-2 text-xs font-medium uppercase text-zinc-500">Quests</p>
                          <ul className="flex flex-col gap-2">
                            {(revealed[p.id] ?? []).map((q, i) => (
                              <li
                                key={i}
                                className={`rounded border p-2 text-sm ${
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
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
          </tbody>
        </table>
      </div>
      <HostJoinRequestModal
        gameId={gameId}
        token={token}
        enabled={state.me?.isHost === true && state.game.status === "ACTIVE"}
        requests={state.pendingJoinRequests ?? []}
        onChanged={() => void refresh()}
      />
      <p className="instruction-copy text-xs text-zinc-500">
        {isTeamBoard
          ? "Tap an alliance to expand, then tap a member to load their quests."
          : "Tap a row to show or hide that player's quests."}
      </p>
    </div>
  );
}
