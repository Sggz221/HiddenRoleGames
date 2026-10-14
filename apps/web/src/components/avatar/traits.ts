/**
 * Villager portraits. Every player gets one, derived from their player id: the id is a
 * random UUID chosen by the server, so the look is random per player yet identical on every
 * screen, and it survives reconnections and the trip from the lobby to the game. Purely
 * cosmetic: it says nothing about the player's role.
 */

export const SKIN_TONES = [
  "#f7dcc6",
  "#ecc4a2",
  "#d9a77f",
  "#c08a5f",
  "#9a6643",
  "#70472e",
  "#4f3121",
] as const;

export const HAIR_COLORS = [
  "#1d1612", // black
  "#3a2416", // dark brown
  "#64412a", // brown
  "#9a5a2c", // auburn
  "#b7452a", // red
  "#c79a55", // dark blond
  "#e1c587", // flaxen
  "#9b958d", // grey
] as const;

export type Gender = "female" | "male";

export const HAIRSTYLES = {
  female: ["long", "braid", "twinBraids", "bun", "coif"],
  male: ["cropped", "bowl", "shaggy", "long", "bald"],
} as const;

export type Hairstyle = (typeof HAIRSTYLES)[Gender][number];

/** Village clothes: rough wool and linen, no finery. */
export const GARMENTS = {
  female: ["apronDress", "bodice", "shawl", "hood"],
  male: ["tunic", "jerkin", "smock", "hood"],
} as const;

export type Garment = (typeof GARMENTS)[Gender][number];

/** Cheap natural dyes: undyed linen, wool browns and greys, madder, weld, woad, moss. */
export const CLOTH_COLORS = [
  "#cdbf9f", // undyed linen
  "#a59577", // oatmeal wool
  "#6e4b32", // walnut brown
  "#8a3b29", // madder russet
  "#5d6a3a", // moss
  "#4d6276", // faded woad
  "#a9843a", // weld ochre
  "#6f6b63", // grey wool
] as const;

export const FACIAL_HAIR = ["none", "stubble", "beard", "moustache"] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];

export interface AvatarTraits {
  gender: Gender;
  skin: string;
  hairstyle: Hairstyle;
  hairColor: string;
  garment: Garment;
  /** Main garment colour. */
  cloth: string;
  /** Second garment colour: apron, shawl, hood lining or the shirt under a jerkin. */
  trim: string;
  /** Always "none" for women. */
  facialHair: FacialHair;
  freckles: boolean;
}

/** FNV-1a: turns the id into a 32-bit seed. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, well-spread generator for the successive picks. */
function generator(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(next: () => number, options: readonly T[]): T {
  const value = options[Math.floor(next() * options.length)];
  if (value === undefined) throw new Error("cannot pick from an empty list");
  return value;
}

/** The look of the villager behind `id`. Same id, same villager. */
export function avatarTraits(id: string): AvatarTraits {
  const next = generator(hash(id));
  const gender: Gender = next() < 0.5 ? "female" : "male";
  const cloth = pick(next, CLOTH_COLORS);
  // The trim never matches the garment, or apron and dress would melt together.
  const trims = CLOTH_COLORS.filter((color) => color !== cloth);
  return {
    gender,
    skin: pick(next, SKIN_TONES),
    hairstyle: pick(next, HAIRSTYLES[gender]),
    hairColor: pick(next, HAIR_COLORS),
    garment: pick(next, GARMENTS[gender]),
    cloth,
    trim: pick(next, trims),
    facialHair: gender === "male" ? pick(next, FACIAL_HAIR) : "none",
    freckles: next() < 0.2,
  };
}
