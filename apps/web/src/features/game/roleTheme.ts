import { ROLES, type RoleId, type Side } from "@howlsinthedark/shared";

/**
 * How a role colours the screen. Wolves (and anyone who has joined the pack) get blood red
 * on near-black with the gothic face; the rest of the village keeps the body font with an
 * accent that matches what the card does (the seer's cold blue, the witch's potion green...).
 */
export interface RoleTheme {
  /** Main accent (rings, borders, buttons). */
  accent: string;
  /** Text on top of the accent colour. */
  onAccent: string;
  /** Panel tint behind the glass. */
  tint: string;
  /** The gothic face is reserved for the pack. */
  font: "wolf" | "body";
}

const WOLF: RoleTheme = { accent: "#e0323f", onAccent: "#fff1f1", tint: "#1a0508", font: "wolf" };

const VILLAGE: Record<RoleId, string> = {
  villager: "#e9dfc4",
  seer: "#7dd3fc",
  witch: "#6ee7b7",
  hunter: "#fbbf24",
  cupid: "#f9a8d4",
  "little-girl": "#c4b5fd",
  sister: "#f0abfc",
  fox: "#fb923c",
  salvador: "#93c5fd",
  knight: "#cbd5e1",
  elder: "#d6c7a1",
  "bear-tamer": "#d4a373",
  "wild-child": "#86efac",
  "wolf-hound": "#fca5a5",
  piper: "#a78bfa",
  angel: "#fde68a",
  // Wolf cards: only used if somehow on the village side.
  werewolf: "#e9dfc4",
  "infected-father": "#e9dfc4",
  "big-bad-wolf": "#e9dfc4",
  "white-werewolf": "#f1f5f9",
};

/** The theme for a player's card, given the side they are on right now. */
export function roleTheme(role: RoleId, side: Side): RoleTheme {
  if (side === "wolves" || ROLES[role].initialSide === "wolves") {
    // The White Werewolf hunts with the pack but plays alone: pale on blood.
    return role === "white-werewolf" ? { ...WOLF, accent: "#f1f5f9", onAccent: "#1a0508" } : WOLF;
  }
  return { accent: VILLAGE[role], onAccent: "#0b1020", tint: "#0b1020", font: "body" };
}

/** CSS custom properties for a theme, to put on the game's root element. */
export const themeVars = (theme: RoleTheme): Record<string, string> => ({
  "--accent": theme.accent,
  "--on-accent": theme.onAccent,
  "--tint": theme.tint,
});
