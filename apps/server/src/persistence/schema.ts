import type { GameState } from "@aullidos/game-engine";
import type { GameConfig, RoleId, Side, WinnerTeam } from "@aullidos/shared";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Finished games. Live games are kept in Redis; they land here when they end. */
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey(),
    config: jsonb("config").$type<GameConfig>().notNull(),
    winnerTeam: text("winner_team").$type<WinnerTeam>().notNull(),
    days: integer("days").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull().defaultNow(),
    /** Full final state: enables replays and debugging of rule disputes. */
    finalState: jsonb("final_state").$type<GameState>().notNull(),
  },
  (table) => [index("games_ended_at_idx").on(table.endedAt)],
);

export const gamePlayers = pgTable(
  "game_players",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull(),
    /** Linked account (phase 2); null for guests. */
    userId: uuid("user_id"),
    name: text("name").notNull(),
    seat: integer("seat").notNull(),
    role: text("role").$type<RoleId>().notNull(),
    finalSide: text("final_side").$type<Side>().notNull(),
    survived: boolean("survived").notNull(),
    won: boolean("won").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.playerId] }),
    index("game_players_user_id_idx").on(table.userId),
  ],
);
