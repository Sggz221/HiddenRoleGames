import type {
  AckResponse,
  ChatChannel,
  ChatMessage,
  ClientToServerEvents,
  ErrorCode,
  GameAction,
  GameEventPayload,
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
  /** Server clock minus ours, measured on each view: the countdown uses the server's time. */
  clockOffset: number;
  /** Chat lines this player may read, oldest first (no history from before joining). */
  chat: ChatMessage[];
}

export type Result = { ok: true } | { ok: false; code: ErrorCode | "TIMEOUT" };

/** Identifies a phase (and day): the action panel and the clock reset when it changes. */
export const phaseKey = (game: GameViewMessage): string =>
  `${game.view.day}|${JSON.stringify(game.view.phase)}`;

/** Kept on the client so a long game does not grow memory without bound. */
const NARRATION_LIMIT = 200;
const CHAT_LIMIT = 300;

/**
 * Client side of a player's seat: one connection, the room, the game view and the narration.
 * The server decides everything; this only sends intentions and keeps what it is told.
 * After every (re)connection it resumes the seat with the stored `sessionToken` (ADR 0003).
 */
export class SessionStore {
  private state: SessionState;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(events: GameEventPayload[]) => void>();
  private readonly chatListeners = new Set<(message: ChatMessage) => void>();

  constructor(
    private readonly socket: SessionSocket,
    private readonly tokens: TokenStorage,
    private readonly now: () => number = Date.now,
  ) {
    this.state = {
      connection: "connecting",
      resuming: tokens.get() !== null,
      playerId: null,
      room: null,
      game: null,
      narration: [],
      clockOffset: 0,
      chat: [],
    };

    socket.on("connect", () => {
      this.update({ connection: "online" });
      void this.resume();
    });
    socket.on("disconnect", () => this.update({ connection: "offline" }));
    socket.on("room:state", (room) => {
      const started = room.gameId !== null && room.gameId !== this.state.room?.gameId;
      // A finished game stays on screen (result and roles) until the player goes back.
      const finished = this.state.game?.view.result != null;
      this.update({
        room,
        ...(started ? { game: null, narration: [], chat: [] } : {}),
        ...(room.gameId === null && !finished ? { game: null, narration: [] } : {}),
      });
    });
    socket.on("game:view", (game) => {
      this.update({ game, clockOffset: game.serverNow - this.now() });
    });
    socket.on("chat:message", (message) => {
      // Several tabs or a resend can deliver the same line twice.
      if (this.state.chat.some((line) => line.id === message.id)) return;
      this.update({ chat: [...this.state.chat, message].slice(-CHAT_LIMIT) });
      for (const listener of this.chatListeners) listener(message);
    });
    socket.on("game:events", (events) => {
      for (const listener of this.eventListeners) listener(events);
    });
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
    this.update({ playerId: null, room: null, game: null, narration: [], chat: [] });
    return response;
  }

  startGame(options: RoomStart): Promise<Result> {
    return this.request<AckResponse>("room:start", options);
  }

  /**
   * Sends an intention; the server checks it against the rules and answers with a new view,
   * whose `you.choice` is what this player has chosen (so it survives reloads).
   */
  sendAction(action: GameAction): Promise<Result> {
    return this.request<AckResponse>("game:action", action);
  }

  /** Says something in a channel; the server decides whether this player may write there. */
  sendChat(channel: ChatChannel, text: string): Promise<Result> {
    return this.request<AckResponse>("chat:send", { channel, text });
  }

  /** New chat lines as they arrive (for sounds and unread badges). */
  onChat(listener: (message: ChatMessage) => void): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  /** Leaves the end-of-game screen and goes back to the room's lobby. */
  dismissResult(): void {
    this.update({ game: null, narration: [] });
  }

  /** Raw game events, for sound and animation. */
  onGameEvents(listener: (events: GameEventPayload[]) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
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
