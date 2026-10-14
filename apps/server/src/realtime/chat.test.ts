import type { Bot } from "@howlsinthedark/bots";
import { CHAT_MESSAGE_MAX_LENGTH } from "@howlsinthedark/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { settle, startTestServer, type TestServer } from "../testing/realtime-harness.js";
import { CHAT_RATE_LIMIT } from "./chat.js";

const lines = (bot: Bot | undefined) =>
  (bot?.chats ?? []).map(({ message }) => ({
    channel: message.channel,
    from: message.from,
    name: message.name,
    text: message.text,
  }));

describe("chat", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(() => server.stop());

  describe("in the lobby", () => {
    it("general reaches every member with the author's name", async () => {
      const bots = await server.table(3);
      const [ana] = bots;
      await expect(ana?.say("general", "  hola  ")).resolves.toEqual({ ok: true });
      await settle(bots);
      for (const bot of bots) {
        expect(lines(bot)).toEqual([
          { channel: "general", from: ana?.playerId, name: "Bot 0", text: "hola" },
        ]);
        expect(bot.chats[0]?.message.sentAt).toBe(server.clock.now());
      }
    });

    it("secret channels do not exist before the game", async () => {
      const bots = await server.table(2);
      await expect(bots[0]?.say("wolves", "auu")).resolves.toMatchObject({
        ok: false,
        code: "NOT_ALLOWED",
      });
    });

    it("validates the payload", async () => {
      const [ana] = await server.table(1);
      const invalid = [
        "",
        "   ",
        "x".repeat(CHAT_MESSAGE_MAX_LENGTH + 1),
        "line\nbreak",
        "spoof‮evil",
      ];
      for (const text of invalid) {
        await expect(ana?.say("general", text)).resolves.toMatchObject({ code: "INVALID_PAYLOAD" });
      }
      await expect(ana?.say("town" as never, "hi")).resolves.toMatchObject({
        code: "INVALID_PAYLOAD",
      });
      await expect(ana?.say("general", "x".repeat(CHAT_MESSAGE_MAX_LENGTH))).resolves.toEqual({
        ok: true,
      });
      await expect(ana?.say("general", "aúúú 🐺‍🔥")).resolves.toEqual({ ok: true });
    });

    it("requires being in a room", async () => {
      const lonely = await server.bot("Lonely");
      await expect(lonely.say("general", "hi")).resolves.toMatchObject({ code: "NOT_IN_ROOM" });
    });

    it("limits the rate per socket and recovers over time", async () => {
      const bots = await server.table(2);
      const [ana, bea] = bots;
      for (let i = 0; i < CHAT_RATE_LIMIT.capacity; i++) {
        await expect(ana?.say("general", `m${i}`)).resolves.toEqual({ ok: true });
      }
      await expect(ana?.say("general", "spam")).resolves.toMatchObject({ code: "RATE_LIMITED" });
      // Another socket has its own budget.
      await expect(bea?.say("general", "hi")).resolves.toEqual({ ok: true });

      server.clock.advance(1000 / CHAT_RATE_LIMIT.refillPerSecond);
      await expect(ana?.say("general", "later")).resolves.toEqual({ ok: true });
      await settle(bots);
      expect(lines(bea).map((line) => line.text)).not.toContain("spam");
    });
  });

  describe("during a game", () => {
    /** Night 1, wolves step (no Cupid or Seer in the deck, so it is the first step). */
    async function nightGame() {
      const bots = await server.table(7);
      await bots[0]?.start({
        roles: ["werewolf", "werewolf", "villager", "villager", "villager", "villager", "villager"],
        sheriff: false,
      });
      await settle(bots);
      const byRole = (role: string) => bots.filter((bot) => bot.view?.view.you.role === role);
      const [wolfA, wolfB] = byRole("werewolf");
      const villagers = byRole("villager");
      if (!wolfA || !wolfB) throw new Error("roles not dealt");
      expect(wolfA.view?.view.phase).toEqual({ kind: "night", step: "wolves" });
      return { bots, wolfA, wolfB, villagers };
    }

    it("the wolves talk at night and no villager reads them", async () => {
      const { bots, wolfA, wolfB, villagers } = await nightGame();
      expect(wolfA.view?.view.chat.write).toEqual(["wolves"]);
      for (const villager of villagers) expect(villager.view?.view.chat.read).toEqual(["general"]);

      await expect(wolfA.say("wolves", "a por el panadero")).resolves.toEqual({ ok: true });
      await settle(bots);

      const named = {
        channel: "wolves",
        from: wolfA.playerId,
        name: wolfA.name,
        text: "a por el panadero",
      };
      expect(lines(wolfA)).toEqual([named]);
      expect(lines(wolfB)).toEqual([named]);
      for (const villager of villagers) expect(lines(villager)).toEqual([]);
    });

    it("nobody may write in general at night, and only the pack in wolves", async () => {
      const { wolfA, villagers } = await nightGame();
      await expect(villagers[0]?.say("general", "hola?")).resolves.toMatchObject({
        code: "NOT_ALLOWED",
      });
      await expect(wolfA.say("general", "hola")).resolves.toMatchObject({ code: "NOT_ALLOWED" });
      await expect(villagers[1]?.say("wolves", "os veo")).resolves.toMatchObject({
        code: "NOT_ALLOWED",
      });
      await expect(wolfA.say("dead", "boo")).resolves.toMatchObject({ code: "NOT_ALLOWED" });
    });

    it("by day everyone alive talks in general and the dead have their own channel", async () => {
      const { bots, wolfA } = await nightGame();
      const game = server.registry.get(wolfA.room?.gameId ?? "");
      if (!game) throw new Error("no game");
      // Run the night out: the bots already voted, so dawn kills someone.
      const isDebate = () => game.state.phase.kind === "day" && game.state.phase.step === "debate";
      for (let i = 0; i < 10; i++) {
        await settle(bots, game);
        if (isDebate()) break;
        server.clock.advance(Math.max(0, (game.phaseEndsAt ?? 0) - server.clock.now()));
      }
      expect(game.state.phase).toEqual({ kind: "day", step: "debate" });

      const dead = bots.find((bot) => bot.view?.view.you.alive === false);
      const living = bots.filter((bot) => bot !== dead);
      if (!dead) throw new Error("nobody died");
      for (const bot of bots) bot.chats.length = 0;

      await expect(living[0]?.say("general", "¿quién ha sido?")).resolves.toEqual({ ok: true });
      await expect(dead.say("general", "¡fue él!")).resolves.toMatchObject({ code: "NOT_ALLOWED" });
      await expect(dead.say("dead", "qué frío")).resolves.toEqual({ ok: true });
      await settle(bots, game);

      for (const bot of bots) {
        expect(lines(bot).some((line) => line.channel === "general")).toBe(true);
        expect(lines(bot).some((line) => line.channel === "dead")).toBe(bot === dead);
      }
    });
  });
});
