"use client";

import { useCallback, useEffect, useState } from "react";

const INTERVAL_MS = 3000;

export function useGamePoll(gameId: string | null, token: string | null) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    if (!gameId || !token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        cache: "no-store",
        headers: { "x-player-token": token },
      });
      if (!res.ok) {
        setError("Could not load game");
        setData(null);
        return;
      }
      const json = (await res.json()) as unknown;
      setData(json);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [gameId, token]);

  useEffect(() => {
    if (gameId && token) setLoading(true);
    void fetchState();
  }, [fetchState, gameId, token]);

  useEffect(() => {
    if (!gameId) return;
    const id = window.setInterval(() => {
      void fetchState();
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [gameId, fetchState]);

  return { data, error, loading, refresh: fetchState };
}
