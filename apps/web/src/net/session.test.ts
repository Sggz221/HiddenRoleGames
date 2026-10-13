import type { GameResult, GameViewMessage, Phase, RoomStateMessage } from "@howlsinthedark/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { type SessionSocket, SessionStore, type TokenStorage } from "./session";

type Handler = (...args: never[]) => void;

/** Records what the store sends and lets each test script the server's answers. */
class FakeSocket implements SessionSocket {
  connected = false;
  sent: { event: string; args: unknown[] }[] = [];
  replies = new Map<string, unknown>();
  private handlers = new Map<string, Handler[]>();

  connect() {
    this.connected = true;
    this.fire("connect");
  }
  on(event: string, listener: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), listener]);
  }
  async emitWithAck(event: string, ...args: unknown[]) {
    this.sent.push({ event, args });
    if (!this.replies.has(event)) throw new Error("operation has timed out");
    return this.replies.get(event);
  }
  fire(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? [])
      (handler as (...a: unknown[]) => void)(...args);
  }
}

class MemoryTokens implements TokenStorage {
  constructor(public token: string | null = null) {}
  get() {
    return this.token;
  }
  set(token: string | null) {
    this.token = token;
  }
}

const room = (gameId: string | null = null): RoomStateMessage => ({
  code: "ABCDEF",
  hostId: "p1",
  maxPlayers: 20,
  gameId,
  players: [{ id: "p1", name: "Ana", connected: true }],
});

/** A game view with just the fields these tests look at. */
function view({
  result = null,
  serverNow = 0,
  phase = { kind: "day", step: "vote" },
}: {
  result?: GameResult | null;
  serverNow?: number;
  phase?: Phase;
} = {}): GameViewMessage {
  return {
    view: { day: 1, phase, result } as GameViewMessage["view"],
    phaseEndsAt: null,
    serverNow,
  };
}

/** Lets pending promise callbacks (the resume after `connect`) run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SessionStore", () => {
  let socket: FakeSocket;
  let tokens: MemoryTokens;

  beforeEach(() => {
    socket = new FakeSocket();
    tokens = new MemoryTokens();
  });

  it("creates a room, keeps the token and the room", async () => {
    const store = new SessionStore(socket, tokens);
    store.start();
    socket.replies.set("room:create", {
      ok: true,
      playerId: "p1",
      sessionToken: "tok",
      room: room(),
    });

    await expect(store.createRoom("Ana")).resolves.toEqual({ ok: true });
    expect(socket.sent.at(-1)).toEqual({ event: "room:create", args: [{ name: "Ana" }] });
    expect(tokens.token).toBe("tok");
    expect(store.getState()).toMatchObject({ connection: "online", playerId: "p1", room: room() });
  });

  it("returns the server's error code when joining fails", async () => {
    const store = new SessionStore(socket, tokens);
    socket.replies.set("room:join", { ok: false, code: "ROOM_NOT_FOUND", message: "nope" });
    await expect(store.joinRoom("zzzzzz", "Ana")).resolves.toMatchObject({
      ok: false,
      code: "ROOM_NOT_FOUND",
    });
    expect(tokens.token).toBeNull();
  });

  it("resumes the seat with the stored token on every connection", async () => {
    tokens.token = "tok";
    socket.replies.set("session:resume", { ok: true, playerId: "p1", room: room(), gameId: null });
    const store = new SessionStore(socket, tokens);
    expect(store.getState().resuming).toBe(true);

    store.start();
    await flush();
    expect(socket.sent).toEqual([{ event: "session:resume", args: [{ token: "tok" }] }]);
    expect(store.getState()).toMatchObject({ resuming: false, playerId: "p1" });

    socket.fire("disconnect");
    expect(store.getState().connection).toBe("offline");
    socket.fire("connect");
    await flush();
    expect(socket.sent.filter((s) => s.event === "session:resume")).toHaveLength(2);
  });

  it("forgets a token the server no longer knows, but keeps it on a timeout", async () => {
    tokens.token = "tok";
    const store = new SessionStore(socket, tokens);
    store.start(); // no reply scripted: times out
    await flush();
    expect(tokens.token).toBe("tok");
    expect(store.getState().resuming).toBe(false);

    socket.replies.set("session:resume", { ok: false, code: "SESSION_NOT_FOUND", message: "" });
    socket.fire("connect");
    await flush();
    expect(tokens.token).toBeNull();
  });

  it("follows the game: views, narration, and back to the lobby", () => {
    const store = new SessionStore(socket, tokens);
    socket.fire("room:state", room("g1"));
    socket.fire("game:narration", [{ key: "night.falls", params: { day: 1 } }]);
    socket.fire("game:narration", [{ key: "night.wakes.wolves", params: {} }]);
    expect(store.getState().narration.map((line) => line.key)).toEqual([
      "night.falls",
      "night.wakes.wolves",
    ]);

    socket.fire("room:state", room(null));
    expect(store.getState()).toMatchObject({ game: null, narration: [] });
  });

  it("keeps a finished game on screen after the room goes back to the lobby", () => {
    const store = new SessionStore(socket, tokens);
    socket.fire("room:state", room("g1"));
    socket.fire("game:view", view({ result: { team: "village", winners: ["p1"] } }));
    socket.fire("room:state", room(null));
    expect(store.getState().game?.view.result?.team).toBe("village");

    store.dismissResult();
    expect(store.getState().game).toBeNull();
  });

  it("measures the clock offset and forgets the choice when the phase changes", async () => {
    const store = new SessionStore(socket, tokens, () => 1_000);
    socket.fire("game:view", view({ serverNow: 1_250 }));
    expect(store.getState().clockOffset).toBe(250);

    socket.replies.set("game:action", { ok: true });
    await store.sendAction({ type: "vote", target: "p2" });
    expect(store.getState().choice).toEqual({ type: "vote", target: "p2" });

    socket.fire("game:view", view({ serverNow: 1_300 })); // same phase: keep it
    expect(store.getState().choice).not.toBeNull();
    socket.fire("game:view", view({ phase: { kind: "night", step: "wolves" } }));
    expect(store.getState().choice).toBeNull();
  });

  it("does not carry a choice into the next phase when the action closed the current one", async () => {
    const store = new SessionStore(socket, tokens);
    socket.fire("game:view", view());
    // The server answers the last vote with the next phase's view before the ack.
    socket.emitWithAck = async (event: string, ...args: unknown[]) => {
      socket.sent.push({ event, args });
      socket.fire("game:view", view({ phase: { kind: "night", step: "seer" } }));
      return { ok: true };
    };
    await store.sendAction({ type: "vote", target: "p2" });
    expect(store.getState().choice).toBeNull();
  });

  it("does not remember a rejected action, and passes events on to listeners", async () => {
    const store = new SessionStore(socket, tokens);
    socket.replies.set("game:action", { ok: false, code: "INVALID_TARGET", message: "" });
    await expect(store.sendAction({ type: "vote", target: "p9" })).resolves.toMatchObject({
      ok: false,
      code: "INVALID_TARGET",
    });
    expect(store.getState().choice).toBeNull();

    const received: unknown[] = [];
    store.onGameEvents((events) => received.push(...events));
    socket.fire("game:events", [{ type: "bearGrowled" }]);
    expect(received).toEqual([{ type: "bearGrowled" }]);
  });

  it("collects chat lines once each and sends new ones", async () => {
    const store = new SessionStore(socket, tokens);
    const heard: string[] = [];
    store.onChat((message) => heard.push(message.text));
    const line = { id: "m1", channel: "general", from: "p1", name: "Ana", text: "hola", sentAt: 1 };
    socket.fire("chat:message", line);
    socket.fire("chat:message", line);
    expect(store.getState().chat).toHaveLength(1);
    expect(heard).toEqual(["hola"]);

    socket.replies.set("chat:send", { ok: true });
    await expect(store.sendChat("general", "buenas")).resolves.toEqual({ ok: true });
    expect(socket.sent.at(-1)).toEqual({
      event: "chat:send",
      args: [{ channel: "general", text: "buenas" }],
    });
  });

  it("leaving frees the seat locally even if the server already dropped it", async () => {
    tokens.token = "tok";
    const store = new SessionStore(socket, tokens);
    socket.fire("room:state", room());
    socket.replies.set("room:leave", { ok: false, code: "NOT_IN_ROOM", message: "" });
    await store.leaveRoom();
    expect(tokens.token).toBeNull();
    expect(store.getState().room).toBeNull();
  });

  it("notifies subscribers on every change", () => {
    const store = new SessionStore(socket, tokens);
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    socket.fire("room:state", room());
    unsubscribe();
    socket.fire("room:state", room());
    expect(calls).toBe(1);
  });
});
