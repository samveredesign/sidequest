"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { clearSession } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  gameId: string;
  playerId: string;
  codeWord1: string;
  codeWord2: string;
  showCopyCode?: boolean;
  canEndGame?: boolean;
};

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </>
      )}
    </svg>
  );
}

export function GameHeader({
  gameId,
  playerId,
  codeWord1,
  codeWord2,
  showCopyCode,
  canEndGame,
}: Props) {
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const codeDisplay = `${codeWord1} ${codeWord2}`.toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeDisplay);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function confirmLeave() {
    await fetch(`/api/players/${playerId}/leave`, { method: "POST" });
    clearSession();
    setLeaveOpen(false);
    setMenuOpen(false);
    router.push("/");
  }

  async function confirmEndGame() {
    try {
      setEnding(true);
      const res = await fetch(`/api/games/${gameId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostPlayerId: playerId }),
      });
      if (!res.ok) return;
      setEndOpen(false);
      setMenuOpen(false);
      router.push(`/games/${gameId}/leaderboard`);
    } finally {
      setEnding(false);
    }
  }

  return (
    <>
      <header className="flex w-full max-w-3xl flex-col gap-3 pb-4">
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <img src="/media/sidequest_logoicon.png" alt="Side Quest" className="h-9 w-auto" />

        <div className="flex flex-1 flex-wrap items-center justify-center gap-2 min-w-[12rem]">
          <span className="text-center font-mono text-sm font-bold tracking-widest text-zinc-800 dark:text-zinc-100 sm:text-base">
            {codeDisplay}
          </span>
          {showCopyCode ? (
            <button
              type="button"
              onClick={() => void copyCode()}
              className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <HamburgerIcon open={menuOpen} />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setLeaveOpen(true);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Leave game
              </button>
              {canEndGame ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEndOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  End game
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
        <img src="/media/divider.svg" alt="" aria-hidden className="h-auto w-full opacity-90" />
      </header>

      <ConfirmModal
        open={leaveOpen}
        title="Leave Game?"
        message="Are you sure you want to leave this game?"
        confirmLabel="Leave Game"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => void confirmLeave()}
      />
      <ConfirmModal
        open={endOpen}
        title="End Game Early?"
        message="Are you sure? This will end the game now and move everyone to the leaderboard."
        confirmLabel={ending ? "Ending…" : "End Game"}
        onCancel={() => setEndOpen(false)}
        onConfirm={() => void confirmEndGame()}
      />
    </>
  );
}
