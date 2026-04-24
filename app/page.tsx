import Link from "next/link";
import { SessionRestore } from "@/components/SessionRestore";

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <img
        src="/media/home_background.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 z-0 mx-auto h-full w-full object-cover object-center select-none"
        aria-hidden
      />
      <SessionRestore />
      <div className="relative z-10 flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <div>
            <h1 className="m-0">
              <img
                src="/media/side-quest_heading_textured.png"
                alt="Side Quest"
                className="floating-heading mx-auto block h-auto w-full max-w-md"
              />
            </h1>
            <p className="mt-3 text-2xl text-[#1e1e1e]">
              Secret Missions for Legends, Fo0ls and Peasants
            </p>
          </div>
          <div
            className="flex w-full max-w-[620px] items-center justify-center bg-contain bg-center bg-no-repeat px-[11%] py-[10%] aspect-[1010/651]"
            style={{
              backgroundImage: "url(/media/menu_background.png)",
            }}
          >
            <div className="flex w-full max-w-[440px] flex-col gap-[3.5%]">
              <Link
                href="/start"
                className="menu-cta-button -translate-y-[5px] flex w-full aspect-[763/150] items-center justify-center gap-[1.5%] pt-[2%] bg-[url('/media/Button_Border.svg')] bg-[length:100%_100%] bg-center bg-no-repeat text-[clamp(1rem,4.2vw,1.5rem)] text-[#46aa62] whitespace-nowrap"
              >
                <img src="/media/start_s.svg" alt="" aria-hidden className="w-[16%] max-w-[72px] min-w-[34px] h-auto -mt-[1.5%]" />
                <span>tart New Game</span>
              </Link>
              <p className="text-center text-[clamp(1rem,4.2vw,1.5rem)] text-[#1e1e1e]">
                OR
              </p>
              <Link
                href="/join"
                className="menu-cta-button flex w-full aspect-[763/150] items-center justify-center pt-[2%] bg-[url('/media/Button_Border_join.svg')] bg-[length:100%_100%] bg-center bg-no-repeat text-[clamp(1rem,4.2vw,1.5rem)] text-[#c47c45] whitespace-nowrap"
              >
                Join a Game
              </Link>
            </div>
          </div>
          <Link
            href="/how-to-play"
            className="inline-block bg-bottom bg-no-repeat pb-3 text-xl tracking-wide text-[#1e1e1e]"
            style={{ backgroundImage: "url(/media/Underline.svg)", backgroundSize: "100% auto" }}
          >
            HOW TO PLAY
          </Link>
        </div>
      </div>
    </div>
  );
}
