import type { GameState } from "@howlsinthedark/game-engine";
import type { Database } from "./db.js";
import { gamePlayers, games } from "./schema.js";

export interface FinishedGame {
  id: string;
  startedAt: Date;
  state: GameState;
}

/** Stores finished games. Swappable so the server can run without a database. */
export interface GameHistory {
  record(game: FinishedGame): Promise<void>;
}

export class PostgresGameHistory implements GameHistory {
  constructor(private readonly db: Database) {}

  async record({ id, startedAt, state }: FinishedGame): Promise<void> {
    const result = state.result;
    if (!result) throw new Error(`Game ${id} has not ended`);
    const winners = new Set(result.winners);

    await this.db.transaction(async (tx) => {
      await tx
        .insert(games)
        .values({
          id,
          config: state.config,
          winnerTeam: result.team,
          days: state.day,
          startedAt,
          finalState: state,
        })
        .onConflictDoNothing();
      await tx
        .insert(gamePlayers)
        .values(
          state.players.map((player) => ({
            gameId: id,
            playerId: player.id,
            name: player.name,
            seat: player.seat,
            role: player.role,
            finalSide: player.side,
            survived: player.alive,
            won: winners.has(player.id),
          })),
        )
        .onConflictDoNothing();
    });
  }
}

export class NoopGameHistory implements GameHistory {
  async record(): Promise<void> {}
}
