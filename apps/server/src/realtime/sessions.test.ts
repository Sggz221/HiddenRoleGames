import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  type ClientToServerEvents,
  type GameViewMessage,
  gameConfigSchema,
  type RoomAckResponse,
  type RoomStateMessage,
  type ServerToClientEvents,
  type SessionResumeAckResponse,
} from "@howlsinthedark/shared";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameRegistry } from "../game/registry.js";
import { MemoryGameStore } from "../game/store.js";
import { NoopGameHistory } from "../persistence/game-history.js";
import { RoomManager } from "../rooms/manager.js";
import { SessionManager } from "../sessions/session-manager.js";
import { FakeClock } from "../testing/fake-clock.js";
import { createRealtime, socketPublisher } from "./io.js";

const silentLog = { info: () => {}, warn: () => {}, error: () => {} };
const GRACE_MS = 30_000;

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type Seated = Extract<RoomAckResponse, { ok: true }>;

describe("session resume", () => {
  let realtime: ReturnType<typeof createRealtime>;
  let registry: GameRegistry;
  let rooms: RoomManager;
  let clock: FakeClock;
  let url: string;
  let clients: Client[];

  beforeEach(async () => {
    const httpServer = createServer();
    rooms = new RoomManager();
    clock = new FakeClock();
    const sessions = new SessionManager({ graceMs: GRACE_MS, clock });
    let publish: ReturnType<typeof socketPublisher> | undefined;
    registry = new GameRegistry({
      store: new MemoryGameStore(),
      history: new NoopGameHistory(),
      log: silentLog,
      publisher: {
        sendEvents: (...args) => publish?.sendEvents(...args),
        sendView: (...args) => publish?.sendView(...args),
        sendChat: (...args) => publish?.sendChat(...args),
        sendNarration: (...args) => publish?.sendNarration(...args),
      },
    });
    realtime = createRealtime(httpServer, { registry, rooms, sessions, log: silentLog });
    publish = socketPublisher(realtime.io);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
    clients = [];
  });

  afterEach(async () => {
    for (const client of clients) client.close();
    await registry.disposeAll();
    await realtime.close();
  });

  async function connectClient(): Promise<Client> {
    const client: Client = connect(url, { transports: ["websocket"], reconnection: false });
    clients.push(client);
    await new Promise<void>((resolve) => client.on("connect", resolve));
    return client;
  }

  const emitAck = <T>(run: (done: (response: T) => void) => void) =>
    new Promise<T>((resolve) => run(resolve));
  /** Waits for the first `room:state` that satisfies `predicate` (older broadcasts may still be in flight). */
  const stateWhere = (client: Client, predicate: (state: RoomStateMessage) => boolean) =>
    new Promise<RoomStateMessage>((resolve) => {
      const listener = (state: RoomStateMessage) => {
        if (!predicate(state)) return;
        client.off("room:state", listener);
        resolve(state);
      };
      client.on("room:state", listener);
    });
  const nextView = (client: Client) =>
    new Promise<GameViewMessage>((resolve) => client.once("game:view", resolve));

  async function seat(name: string, code?: string): Promise<{ client: Client; seated: Seated }> {
    const client = await connectClient();
    const response = await emitAck<RoomAckResponse>((done) =>
      code
        ? client.emit("room:join", { code, name }, done)
        : client.emit("room:create", { name }, done),
    );
    if (!response.ok) throw new Error(`could not seat ${name}: ${response.message}`);
    return { client, seated: response };
  }

  const resume = (client: Client, token: unknown) =>
    emitAck<SessionResumeAckResponse>((done) => client.emit("session:resume", { token }, done));

  async function lobbyOfFive() {
    const host = await seat("P0");
    const code = host.seated.room.code;
    const others = [];
    for (const name of ["P1", "P2", "P3", "P4"]) others.push(await seat(name, code));
    return { code, players: [host, ...others] };
  }

  it("issues a different token to every player", async () => {
    const { players } = await lobbyOfFive();
    const tokens = new Set(players.map((p) => p.seated.sessionToken));
    expect(tokens.size).toBe(5);
  });

  it("restores a lobby seat when the player returns within the grace period", async () => {
    const { code, players } = await lobbyOfFive();
    const [host, bea] = players;
    if (!host || !bea) throw new Error("setup");

    const isBea = (p: { id: string }) => p.id === bea.seated.playerId;
    const offline = stateWhere(host.client, (s) => s.players.some((p) => isBea(p) && !p.connected));
    bea.client.close();
    await offline;

    clock.advance(GRACE_MS - 1);
    const back = await connectClient();
    const online = stateWhere(host.client, (s) => s.players.every((p) => p.connected));
    const resumed = await resume(back, bea.seated.sessionToken);

    expect(resumed).toMatchObject({ ok: true, playerId: bea.seated.playerId, gameId: null });
    await online;

    clock.advance(GRACE_MS * 10);
    expect(rooms.get(code)?.size).toBe(5);
  });

  it("releases the lobby seat after the grace period and the token stops working", async () => {
    const { players } = await lobbyOfFive();
    const [host, bea] = players;
    if (!host || !bea) throw new Error("setup");

    const offline = stateWhere(host.client, (s) => s.players.some((p) => !p.connected));
    bea.client.close();
    await offline;
    const released = stateWhere(host.client, (s) => s.players.length === 4);
    clock.advance(GRACE_MS);
    await released;

    const back = await connectClient();
    await expect(resume(back, bea.seated.sessionToken)).resolves.toMatchObject({
      ok: false,
      code: "SESSION_NOT_FOUND",
    });
  });

  it("leaving on purpose revokes the token immediately", async () => {
    const { players } = await lobbyOfFive();
    const bea = players[1];
    if (!bea) throw new Error("setup");
    await emitAck((done) => bea.client.emit("room:leave", done));
    const other = await connectClient();
    await expect(resume(other, bea.seated.sessionToken)).resolves.toMatchObject({
      ok: false,
      code: "SESSION_NOT_FOUND",
    });
  });

  it("rejects malformed tokens, unknown tokens and resuming while already seated", async () => {
    const { players } = await lobbyOfFive();
    const host = players[0];
    if (!host) throw new Error("setup");
    const fresh = await connectClient();
    await expect(resume(fresh, "short")).resolves.toMatchObject({ code: "INVALID_PAYLOAD" });
    await expect(resume(fresh, 42)).resolves.toMatchObject({ code: "INVALID_PAYLOAD" });
    await expect(resume(fresh, "x".repeat(43))).resolves.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
    await expect(resume(host.client, host.seated.sessionToken)).resolves.toMatchObject({
      code: "ALREADY_IN_ROOM",
    });
  });

  it("a second tab keeps the seat alive when the first one closes", async () => {
    const { players } = await lobbyOfFive();
    const bea = players[1];
    if (!bea) throw new Error("setup");
    const secondTab = await connectClient();
    await resume(secondTab, bea.seated.sessionToken);

    bea.client.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    clock.advance(GRACE_MS * 2);
    expect(rooms.get(bea.seated.room.code)?.size).toBe(5);
  });

  describe("in the middle of a game", () => {
    async function startGame() {
      const lobby = await lobbyOfFive();
      const config = gameConfigSchema.parse({
        roles: ["werewolf", "seer", "villager", "villager", "villager"],
        sheriff: false,
      });
      const roster = rooms.get(lobby.code)?.state().players ?? [];
      const game = await registry.start(
        config,
        roster.map(({ id, name }) => ({ id, name })),
        7,
        "game-1",
      );
      realtime.attachRoomToGame(lobby.code, game.id);
      return { ...lobby, game };
    }

    it("a player who drops and returns gets their own current view", async () => {
      const { players, game } = await startGame();
      const victim = players[2];
      if (!victim) throw new Error("setup");
      const roleBefore = game.viewFor(victim.seated.playerId).view.you.role;

      victim.client.close();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const back = await connectClient();
      const view = nextView(back);
      const resumed = await resume(back, victim.seated.sessionToken);

      expect(resumed).toMatchObject({ ok: true, gameId: "game-1" });
      const message = await view;
      expect(message.view.you).toMatchObject({ id: victim.seated.playerId, role: roleBefore });
      expect(message.view.phase).toEqual(game.state.phase);
      expect(message.phaseEndsAt).toBe(game.phaseEndsAt);
    });

    it("keeps the seat far beyond the grace period while the game runs", async () => {
      const { code, players } = await startGame();
      const victim = players[3];
      if (!victim) throw new Error("setup");
      victim.client.close();
      await new Promise((resolve) => setTimeout(resolve, 50));
      clock.advance(GRACE_MS * 100);
      expect(rooms.get(code)?.size).toBe(5);

      const back = await connectClient();
      await expect(resume(back, victim.seated.sessionToken)).resolves.toMatchObject({ ok: true });
    });

    it("the resumed connection can act in the current phase", async () => {
      const { players, game } = await startGame();
      expect(game.state.phase).toEqual({ kind: "night", step: "seer" });
      const seer = players.find((p) => game.viewFor(p.seated.playerId).view.you.role === "seer");
      const target = players.find((p) => p !== seer);
      if (!seer || !target) throw new Error("roles not dealt");

      seer.client.close();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const back = await connectClient();
      await resume(back, seer.seated.sessionToken);

      const ack = await emitAck<{ ok: boolean }>((done) =>
        back.emit("game:action", { type: "seerInspect", target: target.seated.playerId }, done),
      );
      expect(ack).toEqual({ ok: true });
      expect(game.state.night.seerTarget).toBe(target.seated.playerId);
    });

    it("does not leak other players' roles to the resumed connection", async () => {
      const { players } = await startGame();
      const victim = players[1];
      if (!victim) throw new Error("setup");
      victim.client.close();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const back = await connectClient();
      const view = nextView(back);
      await resume(back, victim.seated.sessionToken);
      const { view: projected } = await view;
      for (const player of projected.players) {
        if (player.id !== victim.seated.playerId && player.alive) {
          expect(player.role).toBeUndefined();
        }
      }
    });
  });
});
