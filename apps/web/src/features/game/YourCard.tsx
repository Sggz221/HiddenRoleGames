import type { PlayerId, PlayerView } from "@howlsinthedark/shared";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

/** Your card and everything you privately know: lover, sisters, visions, potions... */
export function YourCard({
  view,
  revealed,
  onToggle,
}: {
  view: PlayerView;
  /** Face up or down; shared with the rest of the screen, which hides your role too. */
  revealed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { you } = view;
  const name = (id: PlayerId) => view.players.find((player) => player.id === id)?.name ?? id;

  const facts: string[] = [];
  if (you.infected) facts.push(t("game.you.infected"));
  if (you.lover) facts.push(t("game.you.lover", { name: name(you.lover) }));
  if (you.sisters.length)
    facts.push(t("game.you.sisters", { names: you.sisters.map(name).join(", ") }));
  if (you.wildChildModel)
    facts.push(t("game.you.wildChildModel", { name: name(you.wildChildModel) }));
  if (you.wolfHoundSide)
    facts.push(t("game.you.wolfHound", { side: t(`game.sides.${you.wolfHoundSide}`) }));
  if (you.witchPotions) {
    const state = (available: boolean) => t(available ? "game.you.available" : "game.you.usedUp");
    facts.push(
      t("game.you.potions", {
        heal: state(you.witchPotions.heal),
        poison: state(you.witchPotions.poison),
      }),
    );
  }
  if (you.foxActive === false) facts.push(t("game.you.foxLost"));
  if (you.charmed) facts.push(t("game.you.charmed"));

  const visions = [
    ...you.seerResults.map((result) =>
      t("game.you.seerResult", { name: name(result.target), role: t(`roles.${result.role}`) }),
    ),
    ...you.foxResults.map((result) =>
      t(result.wolfNearby ? "game.you.foxWolf" : "game.you.foxNoWolf", {
        name: name(result.target),
      }),
    ),
  ];

  return (
    <section
      className="rounded-2xl border border-panel-border bg-panel p-4"
      aria-labelledby="card-title"
    >
      <p id="card-title" className="mb-2 text-ink-muted text-xs uppercase tracking-widest">
        {t("game.yourCard")}
      </p>
      <FlipCard revealed={revealed} onToggle={onToggle} role={t(`roles.${you.role}`)} />
      {revealed && facts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      {revealed && visions.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-ink-muted">{t("game.you.visions")}</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {visions.map((vision) => (
              <li key={vision}>{vision}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * Face down until tapped, so a neighbour cannot read it over your shoulder. Flips in 3D;
 * with reduced motion it just swaps faces.
 */
function FlipCard({
  revealed,
  onToggle,
  role,
}: {
  revealed: boolean;
  onToggle: () => void;
  role: string;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const face =
    "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl [backface-visibility:hidden]";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={revealed}
      aria-label={revealed ? `${role}. ${t("game.card.hide")}` : t("game.card.reveal")}
      className="block h-28 w-full [perspective:800px]"
    >
      <motion.div
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
        className="relative size-full [transform-style:preserve-3d]"
      >
        <div
          className={`${face} border border-moon/30 bg-[repeating-linear-gradient(45deg,rgb(244_233_200/0.06)_0_10px,transparent_10px_20px)]`}
        >
          <span className="text-ink-muted text-sm">{t("game.card.reveal")}</span>
        </div>
        <div className={`${face} border border-moon/60 bg-sky-deep [transform:rotateY(180deg)]`}>
          {/* Not even in the DOM while face down. */}
          {revealed && (
            <>
              <span className="font-display text-3xl text-moon">{role}</span>
              <span className="text-ink-muted text-xs">{t("game.card.hide")}</span>
            </>
          )}
        </div>
      </motion.div>
    </button>
  );
}
