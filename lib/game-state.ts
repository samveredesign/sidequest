import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { MAX_FAILS_PER_PLAYER } from "@/lib/game-rules";
import {
  pickFirstFinisher,
  pickLeastProgressPlayer,
  type ProgressPlayer,
} from "@/lib/leaderboard-order";
import {
  includeInLeaderboardList,
  includeInLobbyPlayerList,
} from "@/lib/player-filters";
import { prisma } from "@/lib/prisma";
import { canAllianceSubmit } from "@/lib/secret-alliance";
import type { Player, PlayerQuest } from "@prisma/client";

export type PublicPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  status: Player["status"];
  score: number;
  finishedAt: string | null;
  leftAt: string | null;
  completedQuests: number;
};

export type MePlayer = PublicPlayer & {
  failsUsed: number;
  failsRemaining: number;
};

export type GameOutcome = {
  winnerId: string | null;
  winnerName: string | null;
  loserId: string | null;
  loserName: string | null;
  loserCompletedQuests: number | null;
};

export type QuestRow = {
  id: string;
  questId: string;
  text: string;
  status: PlayerQuest["status"];
  completedAt: string | null;
  failedAt: string | null;
  slotIndex: number | null;
  allianceNeedsPartner: boolean;
};

export type PendingJoinRequest = {
  id: string;
  playerName: string;
  createdAt: string;
};

export type LeaderboardTeamRow = {
  groupId: number;
  memberIds: string[];
  memberNames: string[];
  totalScore: number;
  finishedAt: string | null;
};

function buildLeaderboardTeams(
  game: { mode: string; finishedAt: Date | null },
  boardPlayers: Player[],
): LeaderboardTeamRow[] | null {
  if (game.mode !== "SECRET_ALLIANCE") return null;
  const byGroup = new Map<number, Player[]>();
  for (const p of boardPlayers) {
    if (p.allianceGroup == null) continue;
    const list = byGroup.get(p.allianceGroup) ?? [];
    list.push(p);
    byGroup.set(p.allianceGroup, list);
  }
  const teams: LeaderboardTeamRow[] = [];
  for (const [groupId, members] of byGroup) {
    const finishedTimes = members
      .map((m) => m.finishedAt?.getTime())
      .filter((t): t is number => t != null);
    const finishedAt =
      finishedTimes.length > 0 ? new Date(Math.min(...finishedTimes)) : null;
    teams.push({
      groupId,
      memberIds: members.map((m) => m.id),
      memberNames: members.map((m) => m.name),
      totalScore: members.reduce((s, m) => s + m.score, 0),
      finishedAt: finishedAt?.toISOString() ?? null,
    });
  }
  teams.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.memberNames.join(", ").localeCompare(b.memberNames.join(", "));
  });
  return teams;
}

export async function buildGameState(gameId: string, playerId: string | null) {
  await expireGameIfTimeUp(gameId);

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!game) return null;

  const completedGroups = await prisma.playerQuest.groupBy({
    by: ["playerId"],
    where: { player: { gameId }, status: "COMPLETED" },
    _count: { _all: true },
  });
  const completedByPlayer = new Map(
    completedGroups.map((row) => [row.playerId, row._count._all]),
  );

  const lobbyPlayers = game.players.filter(includeInLobbyPlayerList);
  const leaderboardPlayersRaw = game.players.filter((p) =>
    includeInLeaderboardList(p, game),
  );

  const mapPublic = (p: Player): PublicPlayer => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    status: p.status,
    score: p.score,
    finishedAt: p.finishedAt?.toISOString() ?? null,
    leftAt: p.leftAt?.toISOString() ?? null,
    completedQuests: completedByPlayer.get(p.id) ?? 0,
  });

  const publicPlayers: PublicPlayer[] = lobbyPlayers.map(mapPublic);
  const publicLeaderboardPlayers: PublicPlayer[] =
    leaderboardPlayersRaw.map(mapPublic);

  let me: MePlayer | null = null;
  let myQuests: QuestRow[] | null = null;
  let pendingJoinRequests: PendingJoinRequest[] = [];
  let alliance: {
    groupId: number;
    partnersKnown: boolean;
    partnerNames: string[];
  } | null = null;

  if (playerId) {
    const p = game.players.find((x) => x.id === playerId);
    if (p) {
      const failsUsed = await prisma.playerQuest.count({
        where: { playerId: p.id, status: "FAILED" },
      });
      me = {
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        status: p.status,
        score: p.score,
        finishedAt: p.finishedAt?.toISOString() ?? null,
        leftAt: p.leftAt?.toISOString() ?? null,
        completedQuests: completedByPlayer.get(p.id) ?? 0,
        failsUsed,
        failsRemaining: Math.max(0, MAX_FAILS_PER_PLAYER - failsUsed),
      };

      if (
        game.mode === "SECRET_ALLIANCE" &&
        game.status === "ACTIVE" &&
        p.status === "ACTIVE" &&
        p.allianceGroup != null
      ) {
        const partnerNames = game.players
          .filter(
            (x) =>
              x.allianceGroup === p.allianceGroup &&
              x.id !== p.id &&
              x.status !== "LEFT",
          )
          .map((x) => x.name);
        alliance = {
          groupId: p.allianceGroup,
          partnersKnown: game.partnersKnown,
          partnerNames,
        };
      }

      if (game.status === "ACTIVE" && p.status === "ACTIVE") {
        const rows = await prisma.playerQuest.findMany({
          where: { playerId: p.id },
          include: { quest: true },
          orderBy: { createdAt: "asc" },
        });

        let allyPqs: { playerId: string; slotIndex: number | null; status: string }[] =
          [];
        if (
          game.mode === "SECRET_ALLIANCE" &&
          p.allianceGroup != null
        ) {
          const allyIds = game.players
            .filter(
              (x) =>
                x.allianceGroup === p.allianceGroup &&
                x.id !== p.id &&
                x.status === "ACTIVE",
            )
            .map((x) => x.id);
          if (allyIds.length > 0) {
            allyPqs = await prisma.playerQuest.findMany({
              where: { playerId: { in: allyIds } },
              select: { playerId: true, slotIndex: true, status: true },
            });
          }
        }

        const allyMissingSlot = (slot: number | null) => {
          if (
            game.mode !== "SECRET_ALLIANCE" ||
            p.allianceGroup == null ||
            slot == null
          ) {
            return false;
          }
          const allyIds = game.players
            .filter(
              (x) =>
                x.allianceGroup === p.allianceGroup &&
                x.id !== p.id &&
                x.status === "ACTIVE",
            )
            .map((x) => x.id);
          for (const aid of allyIds) {
            const ok = allyPqs.some(
              (z) =>
                z.playerId === aid &&
                z.slotIndex === slot &&
                z.status === "COMPLETED",
            );
            if (!ok) return true;
          }
          return false;
        };

        myQuests = rows.map((r) => ({
          id: r.id,
          questId: r.questId,
          text: r.quest.text,
          status: r.status,
          completedAt: r.completedAt?.toISOString() ?? null,
          failedAt: r.failedAt?.toISOString() ?? null,
          slotIndex: r.slotIndex ?? null,
          allianceNeedsPartner:
            r.status === "COMPLETED" && allyMissingSlot(r.slotIndex ?? null),
        }));
      }

      if (game.status === "ACTIVE" && p.isHost && p.status !== "LEFT") {
        const reqs = await prisma.joinRequest.findMany({
          where: { gameId, status: "PENDING" },
          orderBy: { createdAt: "asc" },
        });
        pendingJoinRequests = reqs.map((r) => ({
          id: r.id,
          playerName: r.playerName,
          createdAt: r.createdAt.toISOString(),
        }));
      }
    }
  }

  const activeQuestCount =
    myQuests?.filter((q) => q.status === "ACTIVE").length ?? 0;
  let canSubmit =
    game.status === "ACTIVE" &&
    me?.status === "ACTIVE" &&
    activeQuestCount === 0 &&
    (myQuests?.length ?? 0) > 0;

  if (
    game.mode === "SECRET_ALLIANCE" &&
    game.status === "ACTIVE" &&
    me?.status === "ACTIVE" &&
    playerId
  ) {
    canSubmit = (await canAllianceSubmit(prisma, playerId)) && (myQuests?.length ?? 0) > 0;
  }

  const progressRows: ProgressPlayer[] = publicLeaderboardPlayers.map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    finishedAt: player.finishedAt,
    completedQuests: player.completedQuests,
  }));

  let outcome: GameOutcome | null = null;
  if (game.status === "FINISHED" && game.mode === "FIRST_FINISH_WINS") {
    const winner = pickFirstFinisher(progressRows);
    outcome = {
      winnerId: winner?.id ?? null,
      winnerName: winner?.name ?? null,
      loserId: null,
      loserName: null,
      loserCompletedQuests: null,
    };
  } else if (game.status === "FINISHED" && game.mode === "LAST_FINISH_LOSES") {
    const loser = pickLeastProgressPlayer(progressRows);
    outcome = {
      winnerId: null,
      winnerName: null,
      loserId: loser?.id ?? null,
      loserName: loser?.name ?? null,
      loserCompletedQuests: loser?.completedQuests ?? null,
    };
  }

  const leaderboardTeams = buildLeaderboardTeams(game, leaderboardPlayersRaw);

  const endsAt =
    game.status === "ACTIVE" && game.startedAt
      ? new Date(
          game.startedAt.getTime() + game.durationSeconds * 1000,
        ).toISOString()
      : null;

  return {
    game: {
      id: game.id,
      codeWord1: game.codeWord1,
      codeWord2: game.codeWord2,
      status: game.status,
      mode: game.mode,
      durationSeconds: game.durationSeconds,
      numberOfQuests: game.numberOfQuests,
      startedAt: game.startedAt?.toISOString() ?? null,
      finishedAt: game.finishedAt?.toISOString() ?? null,
      createdAt: game.createdAt.toISOString(),
      endsAt,
      partnersKnown: game.partnersKnown,
    },
    players: publicPlayers,
    leaderboardPlayers: publicLeaderboardPlayers,
    me,
    myQuests,
    alliance,
    leaderboardTeams,
    activeQuestCount,
    canSubmit,
    pendingJoinRequests,
    outcome,
  };
}
