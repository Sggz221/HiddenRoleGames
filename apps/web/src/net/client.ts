import type { ClientToServerEvents, ServerToClientEvents } from "@howlsinthedark/shared";
import { io, type Socket } from "socket.io-client";
import { audioManager } from "../audio/audioManager";
import { type SessionSocket, SessionStore, type TokenStorage } from "./session";

const ACK_TIMEOUT_MS = 8_000;
const TOKEN_KEY = "howlsinthedark.session";

const localTokens: TokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null; // Storage blocked (private mode): the seat just cannot survive a reload.
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Same as above.
    }
  },
};

/** Same origin: the server serves the web, and Vite proxies `/socket.io` in development. */
function browserSocket(): SessionSocket {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: false });
  // The event name is dynamic in `request`, which the typed overloads cannot express.
  const untyped = socket as unknown as {
    on(event: string, listener: (...args: never[]) => void): void;
    timeout(ms: number): { emitWithAck(event: string, ...args: unknown[]): Promise<unknown> };
  };
  return {
    get connected() {
      return socket.connected;
    },
    connect: () => socket.connect(),
    on: (event: string, listener: (...args: never[]) => void) => untyped.on(event, listener),
    emitWithAck: (event, ...args) => untyped.timeout(ACK_TIMEOUT_MS).emitWithAck(event, ...args),
  };
}

/** The player's seat for this tab. Call `session.start()` once at boot. */
export const session = new SessionStore(browserSocket(), localTokens);

// Sound effects follow the game events (deaths, nightfall, votes...).
session.onGameEvents((events) => audioManager.handleEvents(events));
