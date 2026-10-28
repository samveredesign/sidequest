"use client";

import { pathForGameSession } from "@/lib/routes";
import { clearSession, readSession } from "@/lib/storage";
import type { GameStateJson } from "@/lib/game-state-types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SessionRestore() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { gameId, playerId, token } = readSession();
    if (!gameId || !playerId || !token) return;

    setBusy(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`, {
          cache: "no-store",
          headers: { "x-player-token": token },
        });
        if (!res.ok) {
          clearSession();
          return;
        }
        const data = (await res.json()) as GameStateJson;
        if (cancelled) return;
        if (!data.me || data.me.status === "LEFT") {
          clearSession();
          return;
        }
        const path = pathForGameSession({
          game: data.game,
          me: data.me,
        });
        if (path) router.replace(path);
      } catch {
        clearSession();
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (busy) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
        Restoring session…
      </p>
    );
  }

  return null;
}
