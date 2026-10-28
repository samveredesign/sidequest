"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { joinTokenStorageKey, saveSession } from "@/lib/storage";

function PendingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");
  const [message, setMessage] = useState("Waiting for the host to respond…");
  const [showHomeLink, setShowHomeLink] = useState(false);

  useEffect(() => {
    if (!requestId) return;

    let alive = true;
    let intervalId: number | undefined;

    const stop = () => {
      alive = false;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };

    const poll = async () => {
      if (!alive) return;
      try {
        const res = await fetch(`/api/join-requests/${requestId}`, { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) {
          setMessage("This join request is no longer valid.");
          setShowHomeLink(true);
          stop();
          return;
        }
        const data = (await res.json()) as {
          status: string;
          gameId?: string;
          playerId?: string;
          reason?: string;
        };

        if (data.status === "PENDING") return;

        if (data.status === "DENIED") {
          if (data.reason === "game_ended") {
            setMessage("The game ended before you could join.");
          } else {
            setMessage("The host declined your request.");
          }
          setShowHomeLink(true);
          stop();
          return;
        }

        if (data.status === "ACCEPTED" && data.gameId && data.playerId) {
          const token = sessionStorage.getItem(joinTokenStorageKey(requestId));
          if (!token) {
            setMessage("You were accepted, but this browser is missing your player session. Rejoin with the same name if you can.");
            setShowHomeLink(true);
            stop();
            return;
          }
          stop();
          saveSession(data.gameId, data.playerId, token);
          sessionStorage.removeItem(joinTokenStorageKey(requestId));
          router.replace(`/games/${data.gameId}/play`);
        }
      } catch {
        if (!alive) return;
        setMessage("Network error — try refreshing.");
        setShowHomeLink(true);
        stop();
      }
    };

    void poll();
    intervalId = window.setInterval(() => void poll(), 2000);

    return () => stop();
  }, [requestId, router]);

  if (!requestId) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-red-600">Missing join request.</p>
        <Link href="/join" className="mt-4 inline-block text-sm underline">
          Back to join
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center px-4 py-16 text-center">
      <h1 className="text-xl font-normal text-zinc-900 dark:text-zinc-50">Waiting for host</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">{message}</p>
      {showHomeLink ? (
        <Link href="/" className="mt-8 text-sm font-medium text-zinc-900 underline dark:text-zinc-100">
          Back to home
        </Link>
      ) : null}
    </div>
  );
}

export default function JoinPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-12 text-center text-zinc-500">Loading…</div>
      }
    >
      <PendingInner />
    </Suspense>
  );
}
