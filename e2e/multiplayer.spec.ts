import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const ARTIFACTS = "/opt/cursor/artifacts";

type Session = {
  gameId: string;
  playerId: string;
  token: string;
  name: string;
  codeWord1: string;
  codeWord2: string;
};

async function createGame(
  request: APIRequestContext,
  opts: { name: string; quests: number; mode: "FIRST_FINISH_WINS" | "LAST_FINISH_LOSES" },
): Promise<Session> {
  const res = await request.post("/api/games", {
    data: {
      playerName: opts.name,
      durationSeconds: 3600,
      numberOfQuests: opts.quests,
      mode: opts.mode,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const data = (await res.json()) as {
    game: { id: string; codeWord1: string; codeWord2: string };
    player: { id: string; token: string; name: string };
  };
  return {
    gameId: data.game.id,
    playerId: data.player.id,
    token: data.player.token,
    name: data.player.name,
    codeWord1: data.game.codeWord1,
    codeWord2: data.game.codeWord2,
  };
}

async function joinLobby(request: APIRequestContext, game: Session, name: string): Promise<Session> {
  const res = await request.post("/api/games/join", {
    data: { playerName: name, word1: game.codeWord1, word2: game.codeWord2 },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const data = (await res.json()) as { player: { id: string; token: string; name: string } };
  return { ...game, playerId: data.player.id, token: data.player.token, name: data.player.name };
}

async function startGame(request: APIRequestContext, host: Session) {
  const res = await request.post(`/api/games/${host.gameId}/start`, {
    headers: { "x-player-token": host.token },
    data: {},
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

async function openSession(browser: Browser, session: Session, path: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript((stored) => {
    localStorage.setItem("gameId", stored.gameId);
    localStorage.setItem("playerId", stored.playerId);
    localStorage.setItem("playerToken", stored.token);
  }, session);
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

test.beforeAll(async () => {
  await mkdir(ARTIFACTS, { recursive: true });
});

test("first to finish wins shows the first finisher above a tied score", async ({ browser, request }) => {
  const zara = await createGame(request, { name: "Zara", quests: 1, mode: "FIRST_FINISH_WINS" });
  const amy = await joinLobby(request, zara, "Amy");
  const bo = await joinLobby(request, zara, "Bo");
  const cid = await joinLobby(request, zara, "Cid");

  const hostPage = await openSession(browser, zara, `/games/${zara.gameId}/lobby`);
  const amyPage = await openSession(browser, amy, `/games/${zara.gameId}/lobby`);
  const boPage = await openSession(browser, bo, `/games/${zara.gameId}/lobby`);
  const cidPage = await openSession(browser, cid, `/games/${zara.gameId}/lobby`);

  await expect(hostPage.getByText("Amy")).toBeVisible();
  await expect(hostPage.getByText("Bo")).toBeVisible();
  await expect(hostPage.getByText("Cid")).toBeVisible();
  await hostPage.getByRole("button", { name: "Start Game" }).click();

  for (const page of [hostPage, amyPage, boPage, cidPage]) {
    await expect(page.getByRole("button", { name: "Complete" }).first()).toBeVisible();
  }

  const amyTitles = await amyPage.locator(".quest-intro").allTextContents();
  const zaraTitles = await hostPage.locator(".quest-intro").allTextContents();
  expect(amyTitles.length).toBeGreaterThan(0);
  expect(zaraTitles.length).toBeGreaterThan(0);
  expect(amyTitles.some((title) => zaraTitles.includes(title))).toBeFalsy();

  await amyPage.getByRole("button", { name: "Complete" }).click();
  await expect(amyPage.getByText("1", { exact: true }).first()).toBeVisible();

  await hostPage.getByRole("button", { name: "Complete" }).click();
  await hostPage.getByRole("button", { name: "Submit Quests" }).click();
  await expect(hostPage.getByText("Zara won — first to finish.")).toBeVisible();
  await expect(hostPage.getByText("Winner")).toBeVisible();
  const firstRow = hostPage.locator("tbody tr").first();
  await expect(firstRow).toContainText("Zara");
  await expect(firstRow).toContainText("Winner");
  await hostPage.screenshot({ path: `${ARTIFACTS}/first_to_finish_winner.png`, fullPage: true });

  await amyPage.context().close();
  await boPage.context().close();
  await cidPage.context().close();
  await hostPage.context().close();
});

test("last to finish loses names the player with the least progress", async ({ browser, request }) => {
  const hal = await createGame(request, { name: "Hal", quests: 2, mode: "LAST_FINISH_LOSES" });
  const mia = await joinLobby(request, hal, "Mia");
  const ned = await joinLobby(request, hal, "Ned");
  const opal = await joinLobby(request, hal, "Opal");
  await startGame(request, hal);

  const halPage = await openSession(browser, hal, `/games/${hal.gameId}/play`);
  const miaPage = await openSession(browser, mia, `/games/${hal.gameId}/play`);
  const nedPage = await openSession(browser, ned, `/games/${hal.gameId}/play`);
  const opalPage = await openSession(browser, opal, `/games/${hal.gameId}/play`);

  await expect(halPage.getByRole("button", { name: "Complete" }).first()).toBeVisible();
  await miaPage.getByRole("button", { name: "Complete" }).nth(0).click();
  await miaPage.getByRole("button", { name: "Complete" }).click();
  await miaPage.getByRole("button", { name: "Submit Quests" }).click();
  await expect(miaPage).toHaveURL(new RegExp(`/games/${hal.gameId}/leaderboard`));
  for (const page of [halPage, nedPage, opalPage]) {
    await page.getByRole("button", { name: "Return to game" }).click();
  }

  await nedPage.getByRole("button", { name: "Complete" }).first().click();
  await halPage.getByRole("button", { name: "Complete" }).first().click();
  await expect(opalPage.getByRole("button", { name: "Complete" }).first()).toBeVisible();

  await halPage.getByRole("button", { name: "Open menu" }).click();
  await halPage.getByRole("menuitem", { name: "End game" }).click({ force: true });
  await expect(halPage.getByRole("heading", { name: "End Game Early?" })).toBeVisible();
  await halPage.getByRole("button", { name: "End Game" }).click();
  await expect(halPage.getByText("Opal lost — least progress (0 quests completed).")).toBeVisible();
  await expect(halPage.getByText("Lost", { exact: true })).toBeVisible();
  await expect(halPage.getByRole("cell", { name: "Opal" })).toBeVisible();
  await expect(halPage.getByRole("cell", { name: "Ned" })).toBeVisible();
  await halPage.screenshot({ path: `${ARTIFACTS}/last_to_finish_loser.png`, fullPage: true });

  await miaPage.context().close();
  await nedPage.context().close();
  await opalPage.context().close();
  await halPage.context().close();
});

test("a late joiner pasted code with whitespace is accepted into the game", async ({ browser, request }) => {
  const host = await createGame(request, { name: "Host", quests: 1, mode: "LAST_FINISH_LOSES" });
  const early = await joinLobby(request, host, "Early");
  await startGame(request, host);

  const hostPage = await openSession(browser, host, `/games/${host.gameId}/play`);
  const earlyPage = await openSession(browser, early, `/games/${host.gameId}/play`);
  await expect(hostPage.getByRole("button", { name: "Complete" })).toBeVisible();
  await expect(earlyPage.getByRole("button", { name: "Complete" })).toBeVisible();

  const joinerContext = await browser.newContext();
  const joiner = await joinerContext.newPage();
  await joiner.goto("/join");
  await joiner.getByLabel("Player name").fill("Late");
  const padded = `  ${host.codeWord1.toUpperCase()} ${host.codeWord2.toUpperCase()}  `;
  await joiner.getByLabel("First word of game code").focus();
  await joiner.evaluate((text) => {
    const target = document.querySelector('[aria-label="First word of game code"]');
    if (!target) throw new Error("missing code box");
    const data = new DataTransfer();
    data.setData("text/plain", text);
    target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
  }, padded);
  await expect(joiner.getByLabel("First word of game code")).toHaveValue(host.codeWord1);
  await expect(joiner.getByLabel("Second word of game code")).toHaveValue(host.codeWord2);
  await joiner.getByRole("button", { name: "Join" }).click();
  await expect(joiner.getByRole("heading", { name: "Waiting for host" })).toBeVisible();

  await expect(hostPage.getByRole("heading", { name: "Join request" })).toBeVisible();
  await hostPage.screenshot({ path: `${ARTIFACTS}/host_accepts_late_joiner.png`, fullPage: true });
  await hostPage.getByRole("button", { name: "Accept" }).click();
  await expect(joiner).toHaveURL(new RegExp(`/games/${host.gameId}/play`));
  await expect(joiner.getByRole("button", { name: "Complete" })).toBeVisible();
  await joiner.screenshot({ path: `${ARTIFACTS}/late_joiner_in_game.png`, fullPage: true });

  await earlyPage.context().close();
  await hostPage.context().close();
  await joinerContext.close();
});

test("host leave promotes another player who can approve a new joiner", async ({ browser, request }) => {
  const host = await createGame(request, { name: "Host", quests: 1, mode: "LAST_FINISH_LOSES" });
  const next = await joinLobby(request, host, "Next");
  const third = await joinLobby(request, host, "Third");
  const fourth = await joinLobby(request, host, "Fourth");
  await startGame(request, host);

  const hostPage = await openSession(browser, host, `/games/${host.gameId}/play`);
  const nextPage = await openSession(browser, next, `/games/${host.gameId}/play`);
  const thirdPage = await openSession(browser, third, `/games/${host.gameId}/play`);
  await openSession(browser, fourth, `/games/${host.gameId}/play`);
  await expect(hostPage.getByRole("button", { name: "Complete" })).toBeVisible();

  await hostPage.getByRole("button", { name: "Open menu" }).click();
  await hostPage.getByRole("menuitem", { name: "Leave game" }).click();
  await hostPage.getByRole("button", { name: "Leave Game" }).click();
  await expect(hostPage).toHaveURL("/");

  await nextPage.getByRole("button", { name: "Open menu" }).click();
  await expect(nextPage.getByRole("menuitem", { name: "End game" })).toBeVisible();
  await nextPage.screenshot({ path: `${ARTIFACTS}/new_host_after_leave.png`, fullPage: true });
  await nextPage.getByRole("button", { name: "Close menu" }).click();

  const joinerContext = await browser.newContext();
  const joiner = await joinerContext.newPage();
  await joiner.goto("/join");
  await joiner.getByLabel("Player name").fill("Fifth");
  await joiner.getByLabel("First word of game code").fill(` ${host.codeWord1} `);
  await joiner.getByLabel("Second word of game code").fill(` ${host.codeWord2} `);
  await expect(joiner.getByLabel("First word of game code")).toHaveValue(host.codeWord1);
  await joiner.getByRole("button", { name: "Join" }).click();
  await expect(joiner.getByRole("heading", { name: "Waiting for host" })).toBeVisible();

  await expect(nextPage.getByRole("heading", { name: "Join request" })).toBeVisible();
  await nextPage.getByRole("button", { name: "Accept" }).click();
  await expect(joiner).toHaveURL(new RegExp(`/games/${host.gameId}/play`));
  await expect(joiner.getByRole("button", { name: "Complete" })).toBeVisible();

  await thirdPage.getByRole("button", { name: "Open menu" }).click();
  await expect(thirdPage.getByRole("menuitem", { name: "End game" })).toHaveCount(0);

  await nextPage.context().close();
  await thirdPage.context().close();
  await joinerContext.close();
});

test("fail limit counts down to zero and then disables Fail", async ({ browser, request }) => {
  const player = await createGame(request, { name: "Failer", quests: 1, mode: "LAST_FINISH_LOSES" });
  await startGame(request, player);
  const page = await openSession(browser, player, `/games/${player.gameId}/play`);
  await expect(page.getByText("5 fails left")).toBeVisible();

  for (const message of ["4 fails left", "3 fails left", "2 fails left", "1 fail left", "0 fails left"]) {
    await page.getByRole("button", { name: "Fail", exact: true }).first().click();
    await page.getByRole("button", { name: "Fail Quest" }).click();
    await expect(page.getByRole("status")).toContainText(message);
  }

  await expect(page.getByText("Fail is unavailable — you have used all 5 fails this game.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fail", exact: true }).first()).toBeDisabled();
  await page.screenshot({ path: `${ARTIFACTS}/fail_limit_reached.png`, fullPage: true });
  await page.context().close();
});

test("start screen sets quests per person and a custom fail limit", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByText("Number of quests per person", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Maximum failed quests per player/)).toHaveValue("5");
  await page.getByLabel("Player name").fill("TwoFails");
  await page.getByLabel(/Number of quests per person/).fill("1");
  await page.getByLabel(/Maximum failed quests per player/).fill("2");
  await page.getByRole("button", { name: "Create game" }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByText("2 fails left")).toBeVisible();
  await page.getByRole("button", { name: "Fail", exact: true }).click();
  await page.getByRole("button", { name: "Fail Quest" }).click();
  await expect(page.getByRole("status")).toContainText("1 fail left");
  await page.screenshot({ path: `${ARTIFACTS}/custom_fail_limit.png`, fullPage: true });
});

test("starting quests cannot exceed 10, and a failed action is shown", async ({ browser, request, page }) => {
  await page.goto("/start");
  await page.getByLabel("Player name").fill("Cap");
  await page.getByLabel(/Number of quests per person/).fill("11");
  await page.getByRole("button", { name: "Create game" }).click();
  await expect(page.getByText("Number of quests per person must be 1–10.")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/quest_cap_ten.png`, fullPage: true });

  const host = await createGame(request, { name: "Host", quests: 1, mode: "FIRST_FINISH_WINS" });
  await startGame(request, host);
  const play = await openSession(browser, host, `/games/${host.gameId}/play`);
  await play.route("**/api/player-quests/**/complete", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Could not complete that quest." }),
    });
  });
  await play.getByRole("button", { name: "Complete" }).click();
  await expect(play.getByRole("button", { name: "Completing…" })).toBeVisible();
  await expect(play.getByText("Could not complete that quest.")).toBeVisible();
  await expect(play).toHaveURL(new RegExp(`/games/${host.gameId}/play`));
  await play.screenshot({ path: `${ARTIFACTS}/action_error_shown.png`, fullPage: true });
  await play.context().close();
});

test("players only see their own quests and cannot load someone else's mid-game", async ({ browser, request }) => {
  const host = await createGame(request, { name: "Host", quests: 1, mode: "FIRST_FINISH_WINS" });
  const other = await joinLobby(request, host, "Other");
  await startGame(request, host);
  const hostPage = await openSession(browser, host, `/games/${host.gameId}/play`);
  const otherPage = await openSession(browser, other, `/games/${host.gameId}/play`);
  await expect(hostPage.getByRole("button", { name: "Complete" })).toBeVisible();
  await expect(otherPage.getByRole("button", { name: "Complete" })).toBeVisible();

  const stolen = await otherPage.evaluate(async (args) => {
    const state = await fetch(`/api/games/${args.gameId}`, {
      headers: { "x-player-token": args.token },
    }).then((res) => res.json());
    const ownId = state.myQuests[0].id;
    const hostQuests = state.players;
    const attempt = await fetch(`/api/player-quests/${ownId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-player-token": args.token },
      body: "{}",
    });
    return { status: attempt.status, playerCount: hostQuests.length, ownId };
  }, { gameId: host.gameId, token: other.token });
  expect(stolen.status).toBe(200);

  const blocked = await otherPage.evaluate(async (args) => {
    const hostState = await fetch(`/api/games/${args.gameId}`, {
      headers: { "x-player-token": args.hostToken },
    }).then((res) => res.json());
    const hostQuestId = hostState.myQuests[0].id;
    const attempt = await fetch(`/api/player-quests/${hostQuestId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-player-token": args.token },
      body: "{}",
    });
    const body = await attempt.json();
    return { status: attempt.status, error: body.error as string };
  }, { gameId: host.gameId, token: other.token, hostToken: host.token });
  expect(blocked.status).toBe(404);
  await expect(hostPage.getByRole("button", { name: "Complete" })).toBeVisible();
  await hostPage.context().close();
  await otherPage.context().close();
});
