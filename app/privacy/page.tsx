import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy · Side Quest",
  description: "What Side Quest collects, why, and how long it is kept.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-12">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:underline">
        <img src="/media/back_arrow.svg" alt="" aria-hidden className="h-3 w-auto" />
        <span>HOME</span>
      </Link>

      <h1 className="text-3xl text-zinc-900">Privacy policy</h1>
      <p className="instruction-copy mt-4 text-base text-zinc-800">
        Last updated: 28 October 2026.
      </p>
      <p className="instruction-copy mt-4 text-base text-zinc-800">
        Side Quest is a free party game you play in a browser with people in the same room. There is no account to
        sign up for. This page says what the game actually stores, why, and how to ask us to delete it. UK GDPR
        applies.
      </p>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">Who we are</h2>
        <p className="instruction-copy">
          Side Quest is run by [OPERATOR NAME]. If you have a privacy question, or you want a copy of your game data
          or want it deleted, email [CONTACT EMAIL].
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">What we collect</h2>
        <p className="instruction-copy">
          We only keep what the game needs in order to run. We do not ask for your email address, phone number, or a
          password.
        </p>
        <p className="instruction-copy">The name you type when you start or join a game.</p>
        <p className="instruction-copy">
          Other people in that game can see your name. They can also see your score, and, when the rules of the mode
          allow it, the quests you were given and whether you completed or failed them.
        </p>
        <p className="instruction-copy">
          A random secret stored on your device so we know which seat is yours after you refresh, without creating an
          account. It lives in your browser&apos;s local storage under the names gameId, playerId, and playerToken.
          While you wait for a host to accept a late join, a temporary copy of that secret sits in session storage for
          that tab only. Two other session-storage flags remember that this tab just opened the lobby or the quest
          screen, so the loading animation can show. They are cleared when that step finishes, and they are not used
          to follow you around the web.
        </p>
        <p className="instruction-copy">
          The shape of the game: the two-word code, how long the round is, how many quests each person starts with,
          the fail limit the host chose, the mode, and whether the game is in the lobby, in progress, or finished.
        </p>
        <p className="instruction-copy">
          What happens in the round: your score, which quests you were dealt, and whether each one is still active,
          completed, or failed. If Secret Alliance is turned on in a future version, the game can also store which
          players were grouped together. That mode is marked coming soon and is not available to start today.
        </p>
        <p className="instruction-copy">
          Times that make the round work: when the game was created, started, and finished; when you joined; when you
          completed or failed a quest; when you left; and lastSeenAt, which updates while your game page is open. We
          use lastSeenAt so that if someone closes their tab, the game can pass the host role on or finish when
          nobody is still playing.
        </p>
        <p className="instruction-copy">
          If you ask to join a game that has already started, we store the name you gave and whether the host accepted
          or denied you.
        </p>
        <p className="instruction-copy">
          We do not store your IP address in the game database. The site is hosted on Vercel, and Vercel&apos;s own
          logs can include IP addresses and ordinary request details (such as the page address) so the site can run
          and stay secure. We do not use those logs to build a profile of you.
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">Why we use it</h2>
        <p className="instruction-copy">
          The lawful basis is legitimate interests. The interest is providing the game you chose to play: dealing
          private quests, keeping score, letting the host run the lobby, and putting you back in the right seat if
          you refresh. We do not use this information for advertising, and we do not sell it.
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">How long we keep it</h2>
        <p className="instruction-copy">
          When someone starts a new game, the site deletes games that were created more than 7 days earlier. That
          deletion includes the players, join requests, and quest activity in those games. There is no separate daily
          cleanup. If nobody starts a new game, older games stay in the database until the next one is created.
        </p>
        <p className="instruction-copy">
          The secret in local storage stays on your device until you leave the game or clear this site&apos;s data in
          your browser. Session storage lasts only for that browser tab.
        </p>
        <p className="instruction-copy">
          Vercel keeps its hosting logs for as long as its own rules say. The game database is held by our database
          provider.
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">Who else sees it</h2>
        <p className="instruction-copy">
          There are no ads, we do not sell personal information, and the game does not use analytics.
        </p>
        <p className="instruction-copy">
          Other players in your game see your name, your score, and — when that mode&apos;s rules say so — your
          quests. That is the point of the leaderboard.
        </p>
        <p className="instruction-copy">
          Two companies process data for us so the site can run. Vercel hosts the website and can log IP addresses.
          Our database provider stores the game records described above. We do not send your game data to anyone else
          for marketing.
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">Cookies and your device</h2>
        <p className="instruction-copy">
          Side Quest does not set cookies for advertising or measurement. The only storage on your device is the
          essential local storage and session storage described above, used to keep you in the game. Because of that,
          we do not show a cookie banner.
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">Children</h2>
        <p className="instruction-copy">
          Side Quest is not directed at children under 13, and we do not knowingly collect their information. If you
          are a parent or guardian and you think a child under 13 has played, email [CONTACT EMAIL] and we will
          delete that game data.
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">Your rights</h2>
        <p className="instruction-copy">
          Under UK GDPR you can ask for a copy of your information, ask us to correct it or delete it, ask us to
          restrict how we use it, and object to our use of it. Where the law gives you a right to data portability,
          you can ask for a copy in a common format.
        </p>
        <p className="instruction-copy">
          Email [CONTACT EMAIL] to make a request. There is no account, so please include the name you used, the game
          code if you still have it, and roughly when you played. That is how we find the right game. You can also
          remove the device secret yourself by leaving the game, or by clearing this site&apos;s data in your browser.
        </p>
        <p className="instruction-copy">
          You can complain to the UK Information Commissioner&apos;s Office at{" "}
          <a href="https://ico.org.uk" className="underline">
            ico.org.uk
          </a>
          .
        </p>
      </section>

      <img src="/media/divider.svg" alt="" aria-hidden className="mx-auto mt-8 h-auto w-full max-w-xl opacity-90" />

      <section className="mt-8 space-y-4 text-base text-zinc-800">
        <h2 className="text-xl text-zinc-900">Contact</h2>
        <p className="instruction-copy">[OPERATOR NAME]</p>
        <p className="instruction-copy">[CONTACT EMAIL]</p>
        <p className="instruction-copy">This page was last updated on 28 October 2026.</p>
      </section>
    </main>
  );
}
