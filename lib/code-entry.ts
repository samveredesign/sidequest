export type ParsedGameCode =
  | { kind: "pair"; w1: string; w2: string }
  | { kind: "word"; word: string };

/**
 * Accept a pasted game code, including leading or trailing whitespace.
 * A single padded word (" MIMIC") fills one box. Two words fill both.
 */
export function parsePastedGameCode(raw: string): ParsedGameCode | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const parts = trimmed
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter((part) => part.length > 0);

  if (parts.length >= 2 && parts[0]!.length === 5 && parts[1]!.length === 5) {
    return { kind: "pair", w1: parts[0]!, w2: parts[1]! };
  }

  const lettersOnly = trimmed.replace(/[^a-z]/g, "");
  if (parts.length === 1 && lettersOnly.length === 10) {
    return {
      kind: "pair",
      w1: lettersOnly.slice(0, 5),
      w2: lettersOnly.slice(5, 10),
    };
  }

  if (lettersOnly.length >= 1 && lettersOnly.length <= 5 && parts.length <= 1) {
    return { kind: "word", word: lettersOnly };
  }

  return null;
}

/** Keep only a–z and cap at one code word. */
export function sanitizeCodeWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
}
