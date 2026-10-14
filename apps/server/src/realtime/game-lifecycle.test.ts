import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  playUntilEnd,
  settle,
  startTestServer,
  type TestServer,
} from "../testing/realtime-harness.js";

describe("room:start", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(() => server.stop());

  it("deals a recommended deck to everyone and sends each player their own view", async () => {
    const bots = await server.table(6);
    const [host] = bots;
    await expect(host?.start()).resolves.toEqual({ ok: true });
    await settle(bots);

    const gameId = host?.room?.gameId;
    expect(gameId).toEqual(expect.any(String));
    for (const bot of bots) {
      expect(bot.room?.gameId).toBe(gameId);
      expect(bot.view?.view.you.id).toBe(bot.playerId);
    }
    const wolves = bots.filter((bot) => bot.view?.view.you.side === "wolves");
    expect(wolves).toHaveLength(1);
  });

  it("uses the host's deck and options", async () => {
    const bots = await server.table(5);
    const roles = ["werewolf", "seer", "witch", "villager", "villager"] as const;
    await expect(bots[0]?.start({ roles: [...roles], sheriff: false })).resolves.toEqual({
      ok: true,
    });
    await settle(bots);
    const dealt = bots.map((bot) => bot.view?.view.you.role).sort();
    expect(dealt).toEqual([...roles].sort());
    expect(bots[0]?.view?.view.phase).toEqual({ kind: "night", step: "seer" });
  });

  it("only the host can start", async () => {
    const bots = await server.table(5);
    await expect(bots[1]?.start()).resolves.toMatchObject({ ok: false, code: "NOT_ALLOWED" });
  });

  it("needs at least five players", async () => {
    const bots = await server.table(4);
    await expect(bots[0]?.start()).resolves.toMatchObject({
      ok: false,
      code: "NOT_ENOUGH_PLAYERS",
    });
  });

  it("rejects decks that do not fit the table or break the rules", async () => {
    const bots = await server.table(5);
    const host = bots[0];
    await expect(
      host?.start({ roles: ["werewolf", "villager", "villager"] }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_CONFIG" });
    await expect(
      host?.start({ roles: ["werewolf", "werewolf", "werewolf", "villager", "villager"] }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_CONFIG" });
    await expect(host?.start({ roles: ["nope"] } as never)).resolves.toMatchObject({
      ok: false,
      code: "INVALID_PAYLOAD",
    });
    await expect(host?.start({ timers: { debateSeconds: 1 } })).resolves.toMatchObject({
      ok: false,
      code: "INVALID_PAYLOAD",
    });
  });

  it("cannot start twice, and nobody can join mid-game", async () => {
    const bots = await server.table(5);
    const host = bots[0];
    await host?.start();
    await expect(host?.start()).resolves.toMatchObject({ ok: false, code: "GAME_IN_PROGRESS" });

    const late = await server.bot("Late");
    await expect(late.joinRoom(host?.room?.code ?? "")).rejects.toThrow("GAME_IN_PROGRESS");
  });

  it("outside a room it answers NOT_IN_ROOM", async () => {
    const lonely = await server.bot("Lonely");
    await expect(lonely.start()).resolves.toMatchObject({ ok: false, code: "NOT_IN_ROOM" });
  });

  it("when the game ends the room returns to the lobby and can start again", async () => {
    const bots = await server.table(5);
    const host = bots[0];
    await host?.start({ maxDays: 5, sheriff: false });
    const gameId = host?.room?.gameId;
    if (!gameId) throw new Error("no game");

    await playUntilEnd(server, gameId, bots);

    expect(host?.view?.view.result).not.toBeNull();
    expect(host?.room?.gameId).toBeNull();
    expect(server.rooms.get(host?.room?.code ?? "")?.gameId).toBeNull();
    await expect(host?.start({ sheriff: false })).resolves.toEqual({ ok: true });
  });
});
