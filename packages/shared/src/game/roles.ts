import { z } from "zod";

/**
 * Role identifiers. Neutral English ids; user-facing names live in the web i18n files.
 * Covers the full "Best Of" character set (see docs/game-design.md).
 */
export const ROLE_IDS = [
  "villager",
  "werewolf",
  "infected-father",
  "big-bad-wolf",
  "white-werewolf",
  "seer",
  "witch",
  "hunter",
  "cupid",
  "little-girl",
  "sister",
  "fox",
  "knight",
  "elder",
  "bear-tamer",
  "wild-child",
  "wolf-hound",
  "piper",
  "angel",
] as const;

export const roleIdSchema = z.enum(ROLE_IDS);
export type RoleId = z.infer<typeof roleIdSchema>;

/** Which pack a player belongs to at a given moment. Infection or transformation can move a player to "wolves". */
export const sideSchema = z.enum(["village", "wolves"]);
export type Side = z.infer<typeof sideSchema>;

/** Card category, as printed on the card. Drives grouping in the UI and deck validation. */
export type RoleCategory = "wolf" | "villager" | "ambiguous" | "loner";

export interface RoleInfo {
  readonly id: RoleId;
  readonly category: RoleCategory;
  /** Side the player starts on. */
  readonly initialSide: Side;
  /** How many copies of the card a deck may contain (`Infinity` = any number). */
  readonly maxCopies: number;
  /** Exact number of copies required when present (only the two sisters). */
  readonly exactCopies?: number;
}

const info = (
  id: RoleId,
  category: RoleCategory,
  initialSide: Side,
  maxCopies = 1,
  exactCopies?: number,
): RoleInfo =>
  exactCopies === undefined
    ? { id, category, initialSide, maxCopies }
    : { id, category, initialSide, maxCopies, exactCopies };

export const ROLES: Readonly<Record<RoleId, RoleInfo>> = {
  villager: info("villager", "villager", "village", Number.POSITIVE_INFINITY),
  werewolf: info("werewolf", "wolf", "wolves", Number.POSITIVE_INFINITY),
  "infected-father": info("infected-father", "wolf", "wolves"),
  "big-bad-wolf": info("big-bad-wolf", "wolf", "wolves"),
  "white-werewolf": info("white-werewolf", "loner", "wolves"),
  seer: info("seer", "villager", "village"),
  witch: info("witch", "villager", "village"),
  hunter: info("hunter", "villager", "village"),
  cupid: info("cupid", "villager", "village"),
  "little-girl": info("little-girl", "villager", "village"),
  sister: info("sister", "villager", "village", 2, 2),
  fox: info("fox", "villager", "village"),
  knight: info("knight", "villager", "village"),
  elder: info("elder", "villager", "village"),
  "bear-tamer": info("bear-tamer", "villager", "village"),
  "wild-child": info("wild-child", "ambiguous", "village"),
  "wolf-hound": info("wolf-hound", "ambiguous", "village"),
  piper: info("piper", "loner", "village"),
  angel: info("angel", "loner", "village"),
};

/** Village roles whose special powers are cancelled when the village kills the Elder. */
export const VILLAGE_POWER_ROLES: readonly RoleId[] = [
  "seer",
  "witch",
  "hunter",
  "little-girl",
  "fox",
  "knight",
  "bear-tamer",
];
