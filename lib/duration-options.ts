/** Allowed round lengths after the host starts the game (seconds). */
export const DURATION_CHOICE_SECONDS = [
  30, // TEST
  1800, // 30 min
  3600, // 1 h
  7200, // 2 h
  10800, // 3 h
  14400, // 4 h
  18000, // 5 h
  21600, // 6 h
  28800, // 8 h
] as const;

export function isAllowedDurationSeconds(s: number): boolean {
  return (DURATION_CHOICE_SECONDS as readonly number[]).includes(s);
}

export const DURATION_LABELS: Record<number, string> = {
  30: "30 Seconds (TEST)",
  1800: "30 minutes",
  3600: "1 hour",
  7200: "2 hours",
  10800: "3 hours",
  14400: "4 hours",
  18000: "5 hours",
  21600: "6 hours",
  28800: "8 hours",
};
