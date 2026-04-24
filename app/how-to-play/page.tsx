import Link from "next/link";

export default function HowToPlayPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-12">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:underline">
        <img src="/media/back_arrow.svg" alt="" aria-hidden className="h-3 w-auto" />
        <span>HOME</span>
      </Link>

      <h1 className="text-3xl text-zinc-900">HOW TO PLAY</h1>

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">BASICS</h2>
        <p className="instruction-copy">
          One player starts a game and shares the two-word game code. Everyone joins the lobby using that code, then
          the host starts the game.
        </p>
        <p className="instruction-copy">
          Each player receives a private set of secret quests. Complete them before the round ends.
        </p>
        <p className="instruction-copy">As you complete quests, you submit them in the app to increase your score.</p>
        <p className="instruction-copy">
          When the game ends, the leaderboard reveals everyone&apos;s final scores and fantasy ranks.
        </p>
      </section>

      <img
        src="/media/divider.svg"
        alt=""
        aria-hidden
        className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90"
      />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">SCORING &amp; QUESTS</h2>
        <p className="instruction-copy">Each completed quest = +1 point</p>
        <p className="instruction-copy">Each failed quest = -1 point</p>
        <p className="instruction-copy">If you cannot complete a quest, tap Fail Quest. This will:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="instruction-copy">Apply a -1 point penalty</span>
          </li>
          <li>
            <span className="instruction-copy">Replace the quest with 2 new quests</span>
          </li>
        </ul>
        <p className="instruction-copy">You must complete all active quests to finish the game.</p>
      </section>

      <img
        src="/media/divider.svg"
        alt=""
        aria-hidden
        className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90"
      />

      <section className="mt-8 space-y-6 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">GAME MODES</h2>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-zinc-900">First to Finish Wins</h3>
          <p className="instruction-copy">
            The first player to complete all their quests wins immediately and ends the game for everyone.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-zinc-900">Last to Finish Loses</h3>
          <p className="instruction-copy">
            Players race to complete their quests. When the game ends, the player with the least progress loses.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-zinc-900">Secret Alliance (4+ players)</h3>
          <p className="instruction-copy">Players are secretly paired into hidden teams.</p>
          <p className="instruction-copy">Before the game starts, the host chooses one of two styles:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="instruction-copy">
                <span className="font-medium">Hidden Allies:</span> Players do not know who their partner is.
              </span>
            </li>
            <li>
              <span className="instruction-copy">
                <span className="font-medium">Known Allies:</span> Players are shown their teammate from the start.
              </span>
            </li>
          </ul>
          <p className="instruction-copy">
            Allies share success indirectly by navigating the same social environment. Coordination and timing are key.
          </p>
        </div>
      </section>

      <img
        src="/media/divider.svg"
        alt=""
        aria-hidden
        className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90"
      />

      <section className="mt-8 space-y-3 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">QUICK TIPS</h2>
        <p className="instruction-copy">Read all your quests early and plan your approach.</p>
        <p className="instruction-copy">Failing quests creates more work, so use it carefully.</p>
        <p className="instruction-copy">Watch other players — someone may be closer to finishing than they appear.</p>
        <p className="instruction-copy">
          In Secret Alliance, your teammate may be obvious… or completely unknown depending on the host&apos;s choice.
        </p>
      </section>
    </main>
  );
}
