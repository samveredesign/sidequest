"use client";

import { pathForGameSession } from "@/lib/routes";
import { readSession } from "@/lib/storage";
import type { GameStateJson } from "@/lib/game-state-types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * If the browser still has an active session, send the user back into the game.
 * Landing is only reachable after Leave Game clears storage.
 */
export function InGameRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const { gameId, playerId } = readSession();
    if (!gameId || !playerId) return;

    setChecking(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/games/${gameId}?playerId=${encodeURIComponent(playerId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setChecking(false);
          return;
        }
        const data = (await res.json()) as GameStateJson;
        if (cancelled) return;
        if (!data.me || data.me.status === "LEFT") {
          setChecking(false);
          return;
        }
        const path = pathForGameSession({
          game: data.game,
          me: data.me,
        });
        if (path) {
          router.replace(path);
          return;
        }
        setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
        You have an active game — redirecting…
      </p>
    );
  }

  return null;
}
