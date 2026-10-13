import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { AckResponse, ClientToServerEvents, ServerToClientEvents } from "@aullidos/shared";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameRegistry } from "../game/registry.js";
import { MemoryGameStore } from "../game/store.js";
import { NoopGameHistory } from "../persistence/game-history.js";
import { RoomManager } from "../rooms/manager.js";
import { SessionManager } from "../sessions/session-manager.js";
import { createRealtime, socketPublisher } from "./io.js";

const silentLog = { info: () => {}, warn: () => {}, error: () => {} };

describe("realtime", () => {
  let realtime: ReturnType<typeof createRealtime>;
  let client: Socket<ServerToClientEvents, ClientToServerEvents>;

  beforeEach(async () => {
    const httpServer = createServer();
    const registry = new GameRegistry({
      store: new MemoryGameStore(),
      history: new NoopGameHistory(),
      log: silentLog,
      publisher: { sendEvents: () => {}, sendView: () => {} },
    });
    realtime = createRealtime(httpServer, {
      registry,
      rooms: new RoomManager(),
      sessions: new SessionManager(),
      log: silentLog,
    });
    socketPublisher(realtime.io);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    client = connect(`http://localhost:${port}`, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client.on("connect", resolve));
  });

  afterEach(async () => {
    client.close();
    await realtime.close();
  });

  const send = (payload: unknown) =>
    new Promise<AckResponse>((resolve) => client.emit("game:action", payload, resolve));

  it("rejects malformed payloads before they reach the engine", async () => {
    await expect(send({ type: "vote" })).resolves.toMatchObject({
      ok: false,
      code: "INVALID_PAYLOAD",
    });
    await expect(send("DROP TABLE")).resolves.toMatchObject({ ok: false, code: "INVALID_PAYLOAD" });
  });

  it("rejects valid actions from sockets that have not joined a game", async () => {
    await expect(send({ type: "skip" })).resolves.toMatchObject({ ok: false, code: "NOT_IN_GAME" });
  });
});
