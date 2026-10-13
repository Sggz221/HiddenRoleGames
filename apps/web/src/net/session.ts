import type {
  AckResponse,
  ClientToServerEvents,
  ErrorCode,
  GameViewMessage,
  NarrationLine,
  PlayerId,
  RoomAckResponse,
  RoomStart,
  RoomStateMessage,
  ServerToClientEvents,
  SessionResumeAckResponse,
} from "@howlsinthedark/shared";

/** The slice of a Socket.IO client the store uses (a fake in tests). */
export interface SessionSocket {
  readonly connected: boolean;
  connect(): void;
  on<E extends keyof ServerToClientEvents>(event: E, listener: ServerToClientEvents[E]): void;
  on(event: "connect" | "disconnect", listener: () => void): void;
  emitWithAck(event: string, ...args: unknown[]): Promise<unknown>;
}

/** Where the `sessionToken` lives between visits (localStorage in the browser). */
export interface TokenStorage {
  get(): string | null;
  set(token: string | null): void;
}

export type Connection = "connecting" | "online" | "offline";

export interface SessionState {
  connection: Connection;
  /** True while a stored token is being exchanged for the seat (show a spinner, not the home). */
  resuming: boolean;
  playerId: PlayerId | null;
  room: RoomStateMessage | null;
  game: GameViewMessage | null;
  /** Narrator lines of the current game, oldest first. */
  narration: NarrationLine[];
}

export type Result = { ok: true } | { ok: false; code: ErrorCode | "TIMEOUT" };

/** Kept on the client so a long game does not grow memory without bound. */
const NARRATION_LIMIT = 200;

/**
 * Client side of a player's seat: one connection, the room, the game view and the narration.
 * The server decides everything; this only sends intentions and keeps what it is told.
 * After every (re)connection it resumes the seat with the stored `sessionToken` (ADR 0003).
 */
export class SessionStore {
  private state: SessionState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly socket: SessionSocket,
    private readonly tokens: TokenStorage,
  ) {
    this.state = {
      connection: "connecting",
      resuming: tokens.get() !== null,
      playerId: null,
      room: null,
      game: null,
      narration: [],
    };

    socket.on("connect", () => {
      this.update({ connection: "online" });
      void this.resume();
    });
    socket.on("disconnect", () => this.update({ connection: "offline" }));
    socket.on("room:state", (room) => {
      // A new game (or the end of one) resets the narration.
      const newGame = room.gameId !== this.state.room?.gameId;
      this.update({
        room,
        ...(newGame ? { narration: [] } : {}),
        ...(room.gameId === null ? { game: null } : {}),
      });
    });
    socket.on("game:view", (game) => this.update({ game }));
    socket.on("game:narration", (lines) =>
      this.update({ narration: [...this.state.narration, ...lines].slice(-NARRATION_LIMIT) }),
    );
  }

  start(): void {
    if (!this.socket.connected) this.socket.connect();
  }

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  createRoom(name: string): Promise<Result> {
    return this.seat("room:create", { name });
  }

  joinRoom(code: string, name: string): Promise<Result> {
    return this.seat("room:join", { code, name });
  }

  async leaveRoom(): Promise<Result> {
    const response = await this.request<AckResponse>("room:leave");
    // Leaving always frees the seat locally, even if the server had already dropped it.
    this.tokens.set(null);
    this.update({ playerId: null, room: null, game: null, narration: [] });
    return response;
  }

  startGame(options: RoomStart): Promise<Result> {
    return this.request<AckResponse>("room:start", options);
  }

  private async seat(event: "room:create" | "room:join", payload: unknown): Promise<Result> {
    const response = await this.request<RoomAckResponse>(event, payload);
    if (!response.ok) return response;
    this.tokens.set(response.sessionToken);
    this.update({ playerId: response.playerId, room: response.room, game: null, narration: [] });
    return { ok: true };
  }

  private async resume(): Promise<void> {
    const token = this.tokens.get();
    if (!token) {
      this.update({ resuming: false });
      return;
    }
    this.update({ resuming: true });
    const response = await this.request<SessionResumeAckResponse>("session:resume", { token });
    if (response.ok) {
      this.update({ resuming: false, playerId: response.playerId, room: response.room });
      return;
    }
    // A timeout may be a flaky network: keep the token for the next reconnection.
    if (response.code !== "TIMEOUT") this.tokens.set(null);
    this.update({ resuming: false, playerId: null, room: null, game: null });
  }

  private async request<T extends { ok: boolean }>(
    event: keyof ClientToServerEvents,
    payload?: unknown,
  ): Promise<T | { ok: false; code: "TIMEOUT" }> {
    try {
      const args = payload === undefined ? [] : [payload];
      return (await this.socket.emitWithAck(event, ...args)) as T;
    } catch {
      return { ok: false, code: "TIMEOUT" };
    }
  }

  private update(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
