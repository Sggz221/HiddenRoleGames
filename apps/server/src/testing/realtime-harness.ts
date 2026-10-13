import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Bot, type BotOptions } from "@aullidos/bots";
import { GameRegistry } from "../game/registry.js";
import { MemoryGameStore } from "../game/store.js";
import { NoopGameHistory } from "../persistence/game-history.js";
import { createRealtime, type RealtimeDeps, socketPublisher } from "../realtime/io.js";
import { RoomManager } from "../rooms/manager.js";
import { SessionManager } from "../sessions/session-manager.js";
import { FakeClock } from "./fake-clock.js";

const silentLog = { info: () => {}, warn: () => {}, error: () => {} };

/** A real HTTP + Socket.IO server on a random port, with a fake clock driving every timer. */
export async function startTestServer(overrides: Partial<RealtimeDeps> = {}) {
  const clock = new FakeClock();
  const rooms = new RoomManager();
  const sessions = new SessionManager({ clock });
  let publish: ReturnType<typeof socketPublisher> | undefined;
  const registry = new GameRegistry({
    store: new MemoryGameStore(),
    history: new NoopGameHistory(),
    log: silentLog,
    clock,
    publisher: {
      sendEvents: (...args) => publish?.sendEvents(...args),
      sendView: (...args) => publish?.sendView(...args),
      sendChat: (...args) => publish?.sendChat(...args),
      sendNarration: (...args) => publish?.sendNarration(...args),
    },
  });
  const httpServer = createServer();
  const realtime = createRealtime(httpServer, {
    registry,
    rooms,
    sessions,
    log: silentLog,
    clock,
    ...overrides,
  });
  publish = socketPublisher(realtime.io);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  const bots: Bot[] = [];

  return {
    url,
    clock,
    rooms,
    sessions,
    registry,
    realtime,
    bots,
    /** Connected bot (not seated yet). Closed by `stop`. */
    async bot(name: string, options: Partial<BotOptions> = {}): Promise<Bot> {
      const bot = new Bot({ url, name, ...options });
      bots.push(bot);
      await bot.connect();
      return bot;
    },
    /** A host plus `count - 1` guests seated in the same room. */
    async table(count: number, options: Partial<BotOptions> = {}): Promise<Bot[]> {
      const seated: Bot[] = [];
      for (let i = 0; i < count; i++) {
        const bot = await this.bot(`Bot ${i}`, { seed: i + 1, ...options });
        const code = seated[0]?.room?.code;
        if (code) await bot.joinRoom(code);
        else await bot.createRoom();
        seated.push(bot);
      }
      return seated;
    },
    async stop() {
      for (const bot of bots) bot.close();
      await registry.disposeAll();
      sessions.dispose();
      await realtime.close();
    },
  };
}

export type TestServer = Awaited<ReturnType<typeof startTestServer>>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves once the game (if any) has processed its queue and no bot has received or sent
 * anything for `quietMs` of real time, so every reaction to the last change has landed.
 */
export async function settle(
  bots: readonly Bot[],
  game?: { whenIdle(): Promise<void> },
  quietMs = 15,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await game?.whenIdle();
    const mark = Date.now();
    await sleep(quietMs);
    if (bots.every((bot) => bot.inFlight === 0 && bot.lastTraffic < mark)) return;
    if (Date.now() > deadline) throw new Error("bots never went quiet");
  }
}

/**
 * Plays a running game to the end: waits for everyone to react, then jumps the fake clock to
 * the end of the current phase. `beforeTimeout` runs at each of those quiet points.
 */
export async function playUntilEnd(
  server: TestServer,
  gameId: string,
  bots: readonly Bot[],
  beforeTimeout?: (game: NonNullable<ReturnType<GameRegistry["get"]>>) => Promise<void> | void,
  maxSteps = 2_000,
): Promise<number> {
  for (let step = 0; step < maxSteps; step++) {
    const game = server.registry.get(gameId);
    if (!game) {
      await settle(bots);
      return step;
    }
    await settle(bots, game);
    if (!server.registry.get(gameId)) continue;
    await beforeTimeout?.(game);
    await settle(bots, game);
    const endsAt = game.phaseEndsAt;
    if (endsAt !== null) server.clock.advance(Math.max(0, endsAt - server.clock.now()));
  }
  throw new Error(`game ${gameId} did not end after ${maxSteps} steps`);
}
