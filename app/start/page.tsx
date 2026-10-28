"use client";

import { FullscreenLoadingOverlay } from "@/components/FullscreenLoadingOverlay";
import { InGameRedirect } from "@/components/InGameRedirect";
import { DURATION_CHOICE_SECONDS, DURATION_LABELS } from "@/lib/duration-options";
import { MAX_STARTING_QUESTS, MIN_STARTING_QUESTS } from "@/lib/game-rules";
import { markLobbyBootstrap } from "@/lib/lobby-bootstrap";
import { saveSession } from "@/lib/storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ModeOpt = "FIRST_FINISH_WINS" | "LAST_FINISH_LOSES" | "SECRET_ALLIANCE";

export default function StartGamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number>(1800);
  const [numQuests, setNumQuests] = useState(3);
  const [mode, setMode] = useState<ModeOpt>("FIRST_FINISH_WINS");
  const [partnersKnown, setPartnersKnown] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !Number.isInteger(numQuests) ||
      numQuests < MIN_STARTING_QUESTS ||
      numQuests > MAX_STARTING_QUESTS
    ) {
      setError(`Number of quests must be ${MIN_STARTING_QUESTS}–${MAX_STARTING_QUESTS}.`);
      return;
    }
    setPending(true);
    let navigated = false;
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: name,
          durationSeconds,
          numberOfQuests: numQuests,
          mode,
          ...(mode === "SECRET_ALLIANCE" ? { partnersKnown } : {}),
        }),
      });
      const text = await res.text();
      let data: {
        error?: string;
        game?: { id: string };
        player?: { id: string; token?: string };
      } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        setError(
          res.ok
            ? "Invalid response from server."
            : `Request failed (${res.status}). Try restarting the dev server after running: npx prisma generate`,
        );
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Failed to create game (${res.status})`);
        return;
      }
      if (data.game && data.player?.id && data.player.token) {
        markLobbyBootstrap(data.game.id);
        saveSession(data.game.id, data.player.id, data.player.token);
        navigated = true;
        router.push(`/games/${data.game.id}/lobby`);
        return;
      }
      setError("Could not create a player session.");
    } catch {
      setError("Network error — check that the dev server is running.");
    } finally {
      if (!navigated) setPending(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col px-4 py-12">
      {pending ? <FullscreenLoadingOverlay label="Creating game…" /> : null}
      <InGameRedirect />
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        <img src="/media/back_arrow.svg" alt="" aria-hidden className="h-3 w-auto" />
        <span>HOME</span>
      </Link>
      <h1 className="text-2xl font-normal text-zinc-900 dark:text-zinc-50">Start New Game</h1>
      <form noValidate onSubmit={onSubmit} className="mt-8 flex w-full flex-col gap-4">
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Round length</span>
          <select
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(Number(e.target.value))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          >
            {DURATION_CHOICE_SECONDS.map((sec) => (
              <option key={sec} value={sec}>
                {DURATION_LABELS[sec] ?? `${sec}s`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Number of quests</span>
          <input
            type="number"
            min={MIN_STARTING_QUESTS}
            max={MAX_STARTING_QUESTS}
            required
            value={numQuests}
            onChange={(e) => setNumQuests(Number(e.target.value))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <span className="text-xs text-zinc-500">Maximum of {MAX_STARTING_QUESTS} starting quests per player.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Game mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ModeOpt)}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="FIRST_FINISH_WINS">First to finish wins</option>
            <option value="LAST_FINISH_LOSES">Last to finish loses</option>
            <option value="SECRET_ALLIANCE" disabled>
              Secret Alliance (coming soon)
            </option>
          </select>
        </label>
        {mode === "SECRET_ALLIANCE" ? (
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={partnersKnown}
              onChange={(e) => setPartnersKnown(e.target.checked)}
              className="mt-1 h-6 w-6 rounded border-zinc-300 dark:border-zinc-600"
            />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Partners are known to each other <span className="mt-1 block font-normal text-zinc-500 dark:text-zinc-400">
                When on, each player sees their partner&apos;s name on the quest screen. When off, partners stay anonymous until they figure it out.
              </span>
            </span>
          </label>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="menu-cta-button mt-2 flex h-16 w-full items-center justify-center pt-[3px] bg-[url('/media/Button_Border.svg')] bg-[length:100%_100%] bg-center bg-no-repeat text-2xl text-[#46aa62] disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create game"}
        </button>
      </form>
    </div>
  );
}
