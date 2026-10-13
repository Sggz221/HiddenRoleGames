import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type {
  AckResponse,
  ClientToServerEvents,
  RoomAckResponse,
  RoomStateMessage,
  ServerToClientEvents,
} from "@aullidos/shared";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameRegistry } from "../game/registry.js";
import { MemoryGameStore } from "../game/store.js";
import { NoopGameHistory } from "../persistence/game-history.js";
import { RoomManager } from "../rooms/manager.js";
import { createRealtime } from "./io.js";

const silentLog = { info: () => {}, warn: () => {}, error: () => {} };

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

describe("room handlers", () => {
  let realtime: ReturnType<typeof createRealtime>;
  let rooms: RoomManager;
  let url: string;
  let clients: Client[];

  beforeEach(async () => {
    const httpServer = createServer();
    rooms = new RoomManager({ joinAttempts: { maxFailures: 3, windowMs: 60_000 } });
    const registry = new GameRegistry({
      store: new MemoryGameStore(),
      history: new NoopGameHistory(),
      log: silentLog,
      publisher: { sendEvents: () => {}, sendView: () => {} },
    });
    realtime = createRealtime(httpServer, { registry, rooms, log: silentLog });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
    clients = [];
  });

  afterEach(async () => {
    for (const client of clients) client.close();
    await realtime.close();
  });

  async function connectClient(): Promise<Client> {
    const client: Client = connect(url, { transports: ["websocket"] });
    clients.push(client);
    await new Promise<void>((resolve) => client.on("connect", resolve));
    return client;
  }

  const create = (client: Client, payload: unknown) =>
    new Promise<RoomAckResponse>((resolve) => client.emit("room:create", payload, resolve));
  const join = (client: Client, payload: unknown) =>
    new Promise<RoomAckResponse>((resolve) => client.emit("room:join", payload, resolve));
  const leave = (client: Client) =>
    new Promise<AckResponse>((resolve) => client.emit("room:leave", resolve));
  const nextState = (client: Client) =>
    new Promise<RoomStateMessage>((resolve) => client.once("room:state", resolve));

  async function hostWithRoom() {
    const host = await connectClient();
    const created = await create(host, { name: "Ana" });
    if (!created.ok) throw new Error("create failed");
    return { host, created };
  }

  it("creates a room and returns the code, the player id and the lobby", async () => {
    const { created } = await hostWithRoom();
    expect(created.room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(created.room.hostId).toBe(created.playerId);
    expect(created.room.players).toEqual([{ id: created.playerId, name: "Ana" }]);
  });

  it("lets a second player join with a lowercase code and notifies the room", async () => {
    const { host, created } = await hostWithRoom();
    const update = nextState(host);
    const guest = await connectClient();
    const joined = await join(guest, { code: ` ${created.room.code.toLowerCase()} `, name: "Bea" });

    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.room.players.map((p) => p.name)).toEqual(["Ana", "Bea"]);
    expect((await update).players.map((p) => p.name)).toEqual(["Ana", "Bea"]);
  });

  it("transfers the host to the next player when the host leaves", async () => {
    const { host, created } = await hostWithRoom();
    const guest = await connectClient();
    const joined = await join(guest, { code: created.room.code, name: "Bea" });
    if (!joined.ok) throw new Error("join failed");

    const update = nextState(guest);
    await expect(leave(host)).resolves.toEqual({ ok: true });
    const state = await update;
    expect(state.hostId).toBe(joined.playerId);
    expect(state.players).toEqual([{ id: joined.playerId, name: "Bea" }]);
  });

  it("treats a disconnect as leaving (no grace period yet)", async () => {
    const { host, created } = await hostWithRoom();
    const guest = await connectClient();
    await join(guest, { code: created.room.code, name: "Bea" });

    const update = nextState(guest);
    host.close();
    expect((await update).players.map((p) => p.name)).toEqual(["Bea"]);
  });

  it("destroys the room when the last player leaves", async () => {
    const { host, created } = await hostWithRoom();
    await leave(host);
    expect(rooms.get(created.room.code)).toBeUndefined();
  });

  it("rejects invalid payloads, unknown rooms, taken names and full rooms", async () => {
    const { created } = await hostWithRoom();
    const guest = await connectClient();

    await expect(create(guest, { name: "" })).resolves.toMatchObject({ code: "INVALID_PAYLOAD" });
    await expect(create(guest, "nope")).resolves.toMatchObject({ code: "INVALID_PAYLOAD" });
    await expect(join(guest, { code: "abc", name: "Bea" })).resolves.toMatchObject({
      code: "INVALID_PAYLOAD",
    });
    await expect(join(guest, { code: "ZZZZZZ", name: "Bea" })).resolves.toMatchObject({
      code: "ROOM_NOT_FOUND",
    });
    await expect(join(guest, { code: created.room.code, name: "ana" })).resolves.toMatchObject({
      code: "NAME_TAKEN",
    });
  });

  it("rejects a second create/join from a socket that is already in a room", async () => {
    const { host, created } = await hostWithRoom();
    await expect(create(host, { name: "Otra" })).resolves.toMatchObject({
      code: "ALREADY_IN_ROOM",
    });
    await expect(join(host, { code: created.room.code, name: "Otra" })).resolves.toMatchObject({
      code: "ALREADY_IN_ROOM",
    });
  });

  it("reports leaving when not in a room", async () => {
    const client = await connectClient();
    await expect(leave(client)).resolves.toMatchObject({ ok: false, code: "NOT_IN_ROOM" });
  });

  it("blocks a client that keeps guessing room codes", async () => {
    const { created } = await hostWithRoom();
    const guesser = await connectClient();
    for (let i = 0; i < 3; i++) await join(guesser, { code: "ZZZZZZ", name: "Eve" });
    await expect(join(guesser, { code: created.room.code, name: "Eve" })).resolves.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
    });
  });
});
