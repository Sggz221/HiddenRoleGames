import type { NarrationLine } from "@howlsinthedark/shared";
import type { TFunction } from "i18next";

/**
 * Renders a narrator line sent by the server (`game:narration`). The server picks the text;
 * this only fills it in: names, translated roles and sides, and lists in the locale's format.
 */
export function narrationText(t: TFunction, line: NarrationLine, locale = "es"): string {
  const { actor, player, players, role, side, count, day } = line.params;
  const list = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  return t(`narration.${line.key}`, {
    actor: actor?.name,
    name: player?.name,
    names: players ? list.format(players.map((p) => p.name)) : undefined,
    role: role ? t(`roles.${role}`) : undefined,
    side: side ? t(`sides.${side}`) : undefined,
    count,
    day,
  });
}
