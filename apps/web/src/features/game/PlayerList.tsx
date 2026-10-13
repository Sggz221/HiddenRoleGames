import type { PlayerId, PlayerView } from "@howlsinthedark/shared";
import { Heart, PawPrint, Skull, Sparkles, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { tally } from "./model";

/**
 * Everyone at the table with what the viewer is allowed to know (the server already filtered
 * it) and, during votes, who voted for whom. The pack sees its own wolf votes at night.
 */
export function PlayerList({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const votes = view.wolfVotes ?? view.votes;
  const groups = tally(votes);
  const votersOf = (id: PlayerId) => groups.find((group) => group.target === id)?.voters ?? [];
  const abstained = groups.find((group) => group.target === null)?.voters ?? [];
  const name = (id: PlayerId) => view.players.find((player) => player.id === id)?.name ?? id;

  return (
    <section aria-labelledby="players-title" className="flex flex-col gap-2">
      <h2 id="players-title" className="font-display font-semibold text-xl">
        {t("game.players.title")}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {view.players.map((player) => {
          const voters = votersOf(player.id);
          return (
            <li
              key={player.id}
              className={`flex flex-col gap-1 rounded-xl border border-panel-border px-3 py-2 ${player.alive ? "bg-panel" : "opacity-60"}`}
            >
              <div className="flex items-center gap-2">
                {!player.alive && (
                  <Skull aria-label={t("game.players.dead")} className="size-4 shrink-0" />
                )}
                <span className={`truncate font-medium ${player.alive ? "" : "line-through"}`}>
                  {player.name}
                </span>
                {player.id === view.you.id && (
                  <span className="text-ink-muted text-xs">({t("game.players.you")})</span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  {player.isSheriff && (
                    <Star
                      aria-label={t("game.players.sheriff")}
                      className="size-4 text-amber-300"
                    />
                  )}
                  {player.isWolfAlly && (
                    <PawPrint
                      aria-label={t("game.players.wolfAlly")}
                      className="size-4 text-blood"
                    />
                  )}
                  {player.isLover && (
                    <Heart aria-label={t("game.players.lover")} className="size-4 text-pink-300" />
                  )}
                  {player.charmed && (
                    <Sparkles
                      aria-label={t("game.players.charmed")}
                      className="size-4 text-violet-300"
                    />
                  )}
                </span>
              </div>
              {(player.role || voters.length > 0) && (
                <div className="flex flex-wrap items-center gap-x-3 text-ink-muted text-sm">
                  {player.role && <span className="text-moon">{t(`roles.${player.role}`)}</span>}
                  {voters.length > 0 && (
                    <span>
                      {t("game.players.votes", { count: voters.length })}:{" "}
                      {voters.map(name).join(", ")}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {abstained.length > 0 && (
        <p className="text-ink-muted text-sm">
          {t("game.players.abstained")}: {abstained.map(name).join(", ")}
        </p>
      )}
    </section>
  );
}
