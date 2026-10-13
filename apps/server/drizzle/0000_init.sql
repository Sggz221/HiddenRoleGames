CREATE TABLE "game_players" (
	"game_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"seat" integer NOT NULL,
	"role" text NOT NULL,
	"final_side" text NOT NULL,
	"survived" boolean NOT NULL,
	"won" boolean NOT NULL,
	CONSTRAINT "game_players_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"winner_team" text NOT NULL,
	"days" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone DEFAULT now() NOT NULL,
	"final_state" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_players_user_id_idx" ON "game_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "games_ended_at_idx" ON "games" USING btree ("ended_at");