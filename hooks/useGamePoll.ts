"use client";

import { useCallback, useEffect, useState } from "react";

const INTERVAL_MS = 3000;

export function useGamePoll(gameId: string | null, playerId: string | null) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    if (!gameId) {
      setLoading(false);
      return;
    }
    const q = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
    try {
      const res = await fetch(`/api/games/${gameId}${q}`, {
        cache: "no-store",
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
  }, [gameId, playerId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!gameId) return;
    const id = window.setInterval(() => {
      void fetchState();
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [gameId, fetchState]);

  return { data, error, loading, refresh: fetchState };
}
