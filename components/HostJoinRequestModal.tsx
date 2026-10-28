"use client";

import { authHeaders } from "@/lib/storage";
import { useEffect, useState } from "react";

type RequestRow = { id: string; playerName: string };

type Props = {
  gameId: string;
  token: string;
  enabled: boolean;
  requests: RequestRow[];
  onChanged: () => void;
};

export function HostJoinRequestModal({ gameId, token, enabled, requests, onChanged }: Props) {
  const [current, setCurrent] = useState<RequestRow | null>(null);
  const [busy, setBusy] = useState<"accept" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCurrent(null);
      setError(null);
      return;
    }
    const top = requests[0];
    if (!top) {
      setCurrent(null);
      setError(null);
      return;
    }
    setCurrent((prev) => (prev?.id === top.id ? prev : top));
  }, [enabled, requests]);

  if (!current) return null;

  async function respond(accept: boolean) {
    if (!current || busy) return;
    setBusy(accept ? "accept" : "deny");
    setError(null);
    try {
      const url = `/api/games/${gameId}/join-requests/${current.id}/${accept ? "accept" : "deny"}`;
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(token, true),
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (accept ? "Could not accept" : "Could not deny"));
        return;
      }
      setCurrent(null);
      onChanged();
    } catch {
      setError("Network error — the request was not updated.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-request-title"
      >
        <h2 id="join-request-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Join request
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{current.playerName}</span> wants
          to join this game.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy !== null}
            aria-busy={busy === "deny"}
            onClick={() => void respond(false)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {busy === "deny" ? "Denying…" : "Deny"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            aria-busy={busy === "accept"}
            onClick={() => void respond(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy === "accept" ? "Accepting…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
