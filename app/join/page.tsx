"use client";

import { InGameRedirect } from "@/components/InGameRedirect";
import { parsePastedGameCode, sanitizeCodeWord } from "@/lib/code-entry";
import { joinTokenStorageKey, saveSession } from "@/lib/storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

function normWord(s: string) {
  return s.trim().toLowerCase();
}

export default function JoinGamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [word1, setWord1] = useState("");
  const [word2, setWord2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const word2Ref = useRef<HTMLInputElement>(null);

  function handleCodePaste(target: "w1" | "w2") {
    return (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain");
      const parsed = parsePastedGameCode(text);
      if (!parsed) return;
      e.preventDefault();
      if (parsed.kind === "pair") {
        setWord1(parsed.w1);
        setWord2(parsed.w2);
        queueMicrotask(() => word2Ref.current?.focus());
        return;
      }
      if (target === "w1") {
        setWord1(parsed.word);
        if (parsed.word.length === 5) queueMicrotask(() => word2Ref.current?.focus());
      } else {
        setWord2(parsed.word);
      }
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const w1 = normWord(word1);
    const w2 = normWord(word2);
    if (w1.length !== 5 || w2.length !== 5 || !/^[a-z]+$/.test(w1) || !/^[a-z]+$/.test(w2)) {
      setError("Each word must be exactly five letters (a–z).");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/games/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: name,
          word1: w1,
          word2: w2,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        game?: { id: string };
        player?: { id: string; token?: string };
        joinRequestId?: string;
        gameId?: string;
        playerToken?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not join");
        return;
      }
      if (data.joinRequestId && data.playerToken) {
        sessionStorage.setItem(joinTokenStorageKey(data.joinRequestId), data.playerToken);
        router.push(`/join/pending?requestId=${encodeURIComponent(data.joinRequestId)}`);
        return;
      }
      if (data.game && data.player?.id && data.player.token) {
        saveSession(data.game.id, data.player.id, data.player.token);
        router.push(`/games/${data.game.id}/lobby`);
        return;
      }
      setError("Could not join — the server did not return a player session.");
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-1 flex-col px-4 py-12">
      <InGameRedirect />
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        <img src="/media/back_arrow.svg" alt="" aria-hidden className="h-3 w-auto" />
        <span>HOME</span>
      </Link>
      <h1 className="text-2xl font-normal text-zinc-900 dark:text-zinc-50">Join Game</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        If the round already started, the host must approve your join request.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Player name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Your name"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Game code</span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Two five-letter words from the host (a–z).
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <input
              required
              value={word1}
              onChange={(e) => {
                const v = sanitizeCodeWord(e.target.value);
                setWord1(v);
                if (v.length === 5) {
                  queueMicrotask(() => word2Ref.current?.focus());
                }
              }}
              onPaste={handleCodePaste("w1")}
              maxLength={64}
              aria-label="First word of game code"
              className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2 text-center font-mono tracking-widest sm:flex-1 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="Word 1"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <input
              ref={word2Ref}
              required
              value={word2}
              onChange={(e) => setWord2(sanitizeCodeWord(e.target.value))}
              onPaste={handleCodePaste("w2")}
              maxLength={64}
              aria-label="Second word of game code"
              className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2 text-center font-mono tracking-widest sm:flex-1 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="Word 2"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="menu-cta-button mt-2 flex h-12 w-full items-center justify-center pt-[3px] bg-[url('/media/Button_Border_join.svg')] bg-[length:100%_100%] bg-center bg-no-repeat text-xl text-[#c47c45] disabled:opacity-50"
        >
          {pending ? "Joining…" : "Join"}
        </button>
      </form>
    </div>
  );
}
