import type { GameResult, PlayerView } from "@howlsinthedark/shared";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { narrationText } from "./narration";

/** Who won and every card on the table (at the end everyone sees everything). */
export function ResultPanel({
  view,
  result,
  onBack,
}: {
  view: PlayerView;
  result: GameResult;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const winners = new Set(result.winners);
  const headline = narrationText(t, {
    key: `end.${result.team}`,
    params: { players: view.players.filter((player) => winners.has(player.id)) },
  });

  return (
    <section aria-labelledby="result-title" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-moon/40 bg-panel p-5 text-center">
        <Trophy aria-hidden="true" className="mx-auto size-10 text-moon" />
        <h2 id="result-title" className="mt-2 font-display font-semibold text-2xl">
          {headline}
        </h2>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">{t("game.result.cards")}</h3>
        <ul className="flex flex-col gap-1.5">
          {view.players.map((player) => (
            <li
              key={player.id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${winners.has(player.id) ? "border-moon/60 bg-moon/10" : "border-panel-border"}`}
            >
              <span className={player.alive ? "" : "text-ink-muted line-through"}>
                {player.name}
              </span>
              <span className="text-moon">{player.role ? t(`roles.${player.role}`) : ""}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-xl bg-blood px-6 py-4 font-semibold text-lg text-white transition-colors hover:bg-blood-strong"
      >
        {t("game.result.back")}
      </button>
    </section>
  );
}
