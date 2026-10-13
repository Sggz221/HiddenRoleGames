import type { PlayerId, PlayerView } from "@howlsinthedark/shared";
import { useTranslation } from "react-i18next";

/** Your card and everything you privately know: lover, sisters, visions, potions... */
export function YourCard({ view }: { view: PlayerView }) {
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
      <p id="card-title" className="text-ink-muted text-xs uppercase tracking-widest">
        {t("game.yourCard")}
      </p>
      <p className="font-display text-3xl text-moon">{t(`roles.${you.role}`)}</p>
      {facts.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      {visions.length > 0 && (
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
