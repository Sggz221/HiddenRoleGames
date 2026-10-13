import type {
  AckResponse,
  ChatChannel,
  ChatMessage,
  ClientToServerEvents,
  GameAction,
  GameViewMessage,
  RoomAckResponse,
  RoomStart,
  RoomStateMessage,
  ServerToClientEvents,
  SessionResumeAckResponse,
} from "@aullidos/shared";
import { io, type Socket } from "socket.io-client";
import { chooseAction, createRng } from "./strategy.js";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface BotOptions {
  /** Server origin, e.g. `http://localhost:3000`. */
  url: string;
  name: string;
  /** Seed for the bot's choices (reproducible behaviour). */
  seed?: number;
  /** Say one line per channel and phase where the bot may write (exercises `chat:*`). */
  chat?: boolean;
}

/** Something that went wrong at protocol level: a rejected request or an `error` event. */
export interface ProtocolError {
  event: string;
  code: string;
  message: string;
  payload?: unknown;
}

export interface ReceivedChat {
  message: ChatMessage;
  /** The bot's own view when the line arrived (to check who may read what). */
  view: GameViewMessage | null;
}

const ACK_TIMEOUT_MS = 5_000;

/**
 * A scripted player that talks to the real server through Socket.IO, exactly like the web
 * client: it only reads `game:view` and answers what `view.pending` offers.
 */
export class Bot {
  readonly name: string;
  playerId: string | null = null;
  sessionToken: string | null = null;
  room: RoomStateMessage | null = null;
  view: GameViewMessage | null = null;
  readonly errors: ProtocolError[] = [];
  readonly chats: ReceivedChat[] = [];
  /**
   * Chat lines refused with `NOT_ALLOWED` because the game moved on between the view the bot
   * reacted to and the server receiving the line (e.g. it was shot, or the game ended). That is
   * the server enforcing membership, not a protocol error, so it is kept apart from `errors`.
   */
  readonly staleChats: ProtocolError[] = [];
  readonly actions: GameAction[] = [];
  /** Requests sent and not yet acknowledged. */
  inFlight = 0;
  /** Epoch ms (real clock) of the last message from or to the server. */
  lastTraffic = Date.now();

  private socket: ClientSocket | null = null;
  private readonly rng: () => number;
  private readonly acted = new Set<string>();
  private readonly spoke = new Set<string>();

  constructor(private readonly options: BotOptions) {
    this.name = options.name;
    this.rng = createRng(options.seed ?? 1);
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  async connect(): Promise<void> {
    const socket: ClientSocket = io(this.options.url, {
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
    });
    this.socket = socket;
    socket.on("game:view", (message) => this.onView(message));
    socket.on("room:state", (room) => {
      this.touch();
      this.room = room;
    });
    socket.on("chat:message", (message) => {
      this.touch();
      this.chats.push({ message, view: this.view });
    });
    socket.on("game:events", () => this.touch());
    socket.on("error", (error) => {
      this.touch();
      this.errors.push({ event: "error", ...error });
    });
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });
  }

  async createRoom(): Promise<RoomStateMessage> {
    const response = await this.request<RoomAckResponse>("room:create", { name: this.name });
    return this.seat(response);
  }

  async joinRoom(code: string): Promise<RoomStateMessage> {
    const response = await this.request<RoomAckResponse>("room:join", { code, name: this.name });
    return this.seat(response);
  }

  /** Host only. */
  start(options: RoomStart = {}): Promise<AckResponse> {
    return this.request<AckResponse>("room:start", options);
  }

  say(channel: ChatChannel, text: string): Promise<AckResponse> {
    return this.request<AckResponse>("chat:send", { channel, text });
  }

  /** Drops the connection as if the network failed (the seat is kept by the server). */
  drop(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Opens a new connection and takes the seat back with the stored `sessionToken`. */
  async resume(): Promise<SessionResumeAckResponse> {
    if (!this.sessionToken) throw new Error(`${this.name} has no session to resume`);
    await this.connect();
    const response = await this.request<SessionResumeAckResponse>("session:resume", {
      token: this.sessionToken,
    });
    if (response.ok) this.room = response.room;
    return response;
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private seat(response: RoomAckResponse): RoomStateMessage {
    if (!response.ok) throw new Error(`${this.name}: ${response.code} ${response.message}`);
    this.playerId = response.playerId;
    this.sessionToken = response.sessionToken;
    this.room = response.room;
    return response.room;
  }

  private onView(message: GameViewMessage): void {
    this.touch();
    this.view = message;
    const { view } = message;
    if (this.options.chat) this.chatter(message);

    const key = `${view.day}|${JSON.stringify(view.phase)}`;
    if (!view.pending || this.acted.has(key)) return;
    const action = chooseAction(view, this.rng);
    if (!action) return;
    this.acted.add(key);
    this.actions.push(action);
    this.fireAndForget("game:action", action);
  }

  private chatter({ view }: GameViewMessage): void {
    for (const channel of view.chat.write) {
      const key = `${view.day}|${view.phase.kind}|${channel}`;
      if (this.spoke.has(key)) continue;
      this.spoke.add(key);
      this.fireAndForget("chat:send", {
        channel,
        text: `${this.name} (${channel}, ${view.phase.kind} ${view.day})`,
      });
    }
  }

  /** Sends without awaiting: failures are already recorded by `request`. */
  private fireAndForget(event: keyof ClientToServerEvents, payload: unknown): void {
    this.request<AckResponse>(event, payload).catch(() => {});
  }

  /** Emits with an ack; failures are recorded in `errors` and also returned. */
  private async request<T extends { ok: boolean }>(
    event: keyof ClientToServerEvents,
    payload: unknown,
  ): Promise<T> {
    const socket = this.socket;
    if (!socket) throw new Error(`${this.name} is not connected`);
    // The event name is dynamic here, which the typed overloads cannot express: use the base API.
    const emitter = socket.timeout(ACK_TIMEOUT_MS) as unknown as {
      emitWithAck(event: string, payload: unknown): Promise<T>;
    };
    this.inFlight += 1;
    this.touch();
    try {
      const response = await emitter.emitWithAck(event, payload);
      if (!response.ok) {
        const { code, message } = response as unknown as { code: string; message: string };
        const stale = event === "chat:send" && code === "NOT_ALLOWED";
        (stale ? this.staleChats : this.errors).push({ event, code, message, payload });
      }
      return response;
    } catch (err) {
      // Pending acks are rejected when we close or drop the socket ourselves: not a protocol error.
      if (this.socket === socket) {
        this.errors.push({ event, code: "TIMEOUT", message: String(err), payload });
      }
      throw err;
    } finally {
      this.inFlight -= 1;
      this.touch();
    }
  }

  private touch(): void {
    this.lastTraffic = Date.now();
  }
}
