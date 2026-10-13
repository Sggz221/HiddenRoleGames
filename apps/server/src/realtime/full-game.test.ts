import type { Bot } from "@howlsinthedark/bots";
import { type RoleId, type RoomStart, recommendedDeck } from "@howlsinthedark/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  playUntilEnd,
  settle,
  startTestServer,
  type TestServer,
} from "../testing/realtime-harness.js";

const WINNER_TEAMS = ["village", "wolves", "lovers", "white-werewolf", "piper", "angel", "none"];

/** A richer deck than the recommended one, to exercise more roles and reactions. */
const BEST_OF_8: RoleId[] = [
  "werewolf",
  "infected-father",
  "seer",
  "witch",
  "hunter",
  "little-girl",
  "salvador",
  "fox",
];

/**
 * HID-7 / H2 acceptance: 6-8 bots play a whole game against the real Socket.IO server, chatting
 * where the rules let them, and one of them drops and resumes in the middle of the game.
 */
describe("full game with bots", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(() => server.stop());

  const cases: { players: number; options: RoomStart }[] = [
    { players: 6, options: {} },
    { players: 7, options: { voteTieRule: "sheriff" } },
    { players: 8, options: { roles: BEST_OF_8, revealOnDeath: "side" } },
    { players: 8, options: { sheriff: false, voteTieRule: "no-elimination" } },
  ];

  it.each(cases)("$players bots, options $options", async ({ players, options }) => {
    const bots = await server.table(players, { chat: true });
    const [host] = bots;
    if (!host) throw new Error("no host");
    await expect(host.start(options)).resolves.toEqual({ ok: true });
    const gameId = host.room?.gameId;
    if (!gameId) throw new Error("no game id");

    let dropped: Bot | null = null;
    let resumed = false;
    await playUntilEnd(server, gameId, bots, async (game) => {
      const { day, phase } = game.state;
      // Drop someone alive at the first debate and bring them back one phase later.
      if (!dropped && day >= 1 && phase.kind === "day" && phase.step === "debate") {
        dropped =
          bots.find((bot) => bot.playerId !== host.playerId && bot.view?.view.you.alive) ?? null;
        dropped?.drop();
      } else if (dropped && !resumed) {
        const response = await dropped.resume();
        expect(response).toMatchObject({ ok: true, gameId });
        resumed = true;
      }
    });

    // The game ended with a coherent result, the same for everybody.
    const result = host.view?.view.result;
    if (!result) throw new Error("the game did not end");
    expect(WINNER_TEAMS).toContain(result.team);
    const ids = bots.map((bot) => bot.playerId);
    for (const winner of result.winners) expect(ids).toContain(winner);
    for (const bot of bots) {
      expect(bot.view?.view.result).toEqual(result);
      expect(bot.view?.view.phase).toEqual({ kind: "ended" });
      expect(bot.view?.phaseEndsAt).toBeNull();
      expect(bot.room?.gameId).toBeNull();
    }
    if (dropped) expect(resumed).toBe(true);

    // No protocol errors: every request was accepted and the server never emitted `error`.
    expect(bots.flatMap((bot) => bot.errors.map((error) => ({ bot: bot.name, ...error })))).toEqual(
      [],
    );
    expect(bots.some((bot) => bot.actions.length > 0)).toBe(true);

    // Chat: lines flowed and secret channels reached only who may read them.
    const roleOf = new Map(bots.map((bot) => [bot.playerId, bot.view?.view.you.role]));
    for (const bot of bots) {
      for (const { message, view } of bot.chats) {
        if (message.from === null) {
          expect(message.channel).toBe("wolves");
          expect(roleOf.get(bot.playerId)).toBe("little-girl");
          expect(message.name).toBeNull();
        } else {
          expect(message.name).toBe(bots.find((b) => b.playerId === message.from)?.name);
        }
        if (message.channel === "dead" && view?.view.phase.kind !== "ended") {
          expect(view?.view.you.alive).toBe(false);
        }
      }
    }
    const general = host.chats.filter(({ message }) => message.channel === "general");
    expect(general.length).toBeGreaterThan(0);
  });

  it("the recommended deck for 6-8 players is what an empty start uses", async () => {
    const bots = await server.table(7);
    await bots[0]?.start();
    await settle(bots);
    const dealt = bots.map((bot) => bot.view?.view.you.role).sort();
    expect(dealt).toEqual(recommendedDeck(7).sort());
  });
});
