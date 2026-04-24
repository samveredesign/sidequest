/** Normalize for duplicate-name checks (case-insensitive). */
export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}
