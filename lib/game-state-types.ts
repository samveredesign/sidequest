export type GameStateJson = {
  game: {
    id: string;
    codeWord1: string;
    codeWord2: string;
    status: string;
    mode: string;
    durationSeconds: number;
    numberOfQuests: number;
    maxFailsPerPlayer: number;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    endsAt: string | null;
    partnersKnown: boolean;
  };
  players: {
    id: string;
    name: string;
    isHost: boolean;
    status: string;
    score: number;
    finishedAt: string | null;
    leftAt: string | null;
    completedQuests: number;
  }[];
  /** Subset for leaderboard: excludes early leavers; in LAST_FINISH_LOSES only submitted players until the game ends. */
  leaderboardPlayers: {
    id: string;
    name: string;
    isHost: boolean;
    status: string;
    score: number;
    finishedAt: string | null;
    leftAt: string | null;
    completedQuests: number;
  }[];
  me: {
    id: string;
    name: string;
    isHost: boolean;
    status: string;
    score: number;
    finishedAt: string | null;
    leftAt: string | null;
    completedQuests: number;
    failsUsed: number;
    failsRemaining: number;
  } | null;
  myQuests: {
    id: string;
    questId: string;
    text: string;
    status: string;
    completedAt: string | null;
    failedAt: string | null;
    slotIndex: number | null;
    /** Secret Alliance: you marked complete but a partner has not yet. */
    allianceNeedsPartner: boolean;
  }[] | null;
  /** Secret Alliance in-game: partner display info. */
  alliance: {
    groupId: number;
    partnersKnown: boolean;
    partnerNames: string[];
  } | null;
  /** Secret Alliance finished (or viewing endgame): teams for leaderboard. */
  leaderboardTeams: {
    groupId: number;
    memberIds: string[];
    memberNames: string[];
    totalScore: number;
    finishedAt: string | null;
  }[] | null;
  activeQuestCount: number;
  canSubmit: boolean;
  pendingJoinRequests: {
    id: string;
    playerName: string;
    createdAt: string;
  }[];
  outcome: {
    winnerId: string | null;
    winnerName: string | null;
    loserId: string | null;
    loserName: string | null;
    loserCompletedQuests: number | null;
  } | null;
};
