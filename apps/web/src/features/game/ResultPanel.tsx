import type { GameResult, PlayerView } from "@howlsinthedark/shared";
import { Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { narrationText } from "./narration";
import { ROLE_ICONS } from "./roleIcons";
import { roleTheme } from "./roleTheme";

/** Who won and every card on the table, dealt one by one (at the end everyone sees all). */
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
  const won = winners.has(view.you.id);
  const headline = narrationText(t, {
    key: `end.${result.team}`,
    params: { players: view.players.filter((player) => winners.has(player.id)) },
  });

  return (
    <section aria-labelledby="result-title" className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
        className="glass-strong rounded-[2rem] p-6 text-center"
      >
        <motion.span
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 12 }}
          className="inline-block"
        >
          <Trophy
            aria-hidden="true"
            className={`size-12 ${won ? "text-amber-300" : "text-ink-muted"}`}
          />
        </motion.span>
        <h2 id="result-title" className="mt-2 font-display font-semibold text-2xl sm:text-3xl">
          {headline}
        </h2>
      </motion.div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {view.players.map((player, index) => {
          const theme = player.role ? roleTheme(player.role, "village") : null;
          const Icon = player.role ? ROLE_ICONS[player.role] : null;
          const wolf = theme?.font === "wolf";
          return (
            <motion.li
              key={player.id}
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{
                delay: 0.5 + index * 0.08,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
              className={`glass flex items-center gap-3 rounded-2xl px-3 py-2.5 ${winners.has(player.id) ? "ring-2 ring-amber-300/70" : ""}`}
            >
              {Icon && theme && (
                <Icon
                  aria-hidden="true"
                  className="size-6 shrink-0"
                  style={{ color: theme.accent }}
                />
              )}
              <span className="min-w-0">
                <span
                  className={`block truncate ${player.alive ? "" : "text-ink-muted line-through"}`}
                >
                  {player.name}
                </span>
                <span className={`block text-sm ${wolf ? "font-wolf text-blood" : "text-ink/75"}`}>
                  {player.role ? t(`roles.${player.role}`) : ""}
                </span>
              </span>
            </motion.li>
          );
        })}
      </ul>

      <motion.button
        type="button"
        onClick={onBack}
        whileTap={{ scale: 0.97 }}
        className="w-full rounded-full bg-[var(--accent)] px-6 py-4 font-semibold text-[var(--on-accent)] text-lg shadow-[0_0_30px_-8px_var(--accent)]"
      >
        {t("game.result.back")}
      </motion.button>
    </section>
  );
}
