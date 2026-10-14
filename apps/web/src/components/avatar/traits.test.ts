import { describe, expect, it } from "vitest";
import {
  avatarTraits,
  CLOTH_COLORS,
  FACIAL_HAIR,
  GARMENTS,
  HAIR_COLORS,
  HAIRSTYLES,
  SKIN_TONES,
} from "./traits";

/** Ids shaped like the server's (random UUIDs), but fixed so the test is repeatable. */
const ids = Array.from(
  { length: 3000 },
  (_, i) => `${i.toString(16).padStart(8, "0")}-4f1a-4b2c-9d3e-${(i * 7919).toString(16)}`,
);

describe("avatarTraits", () => {
  it("gives the same villager to the same id", () => {
    const id = "6f1c2a8e-0b4d-4e57-9a31-2c7d5e8f9a10";
    expect(avatarTraits(id)).toEqual(avatarTraits(id));
  });

  it("gives different villagers to different ids", () => {
    const looks = new Set(ids.slice(0, 20).map((id) => JSON.stringify(avatarTraits(id))));
    expect(looks.size).toBe(20);
  });

  it("reaches every skin tone, hair colour, cloth and both genders", () => {
    const all = ids.map(avatarTraits);
    expect(new Set(all.map((t) => t.skin))).toEqual(new Set(SKIN_TONES));
    expect(new Set(all.map((t) => t.hairColor))).toEqual(new Set(HAIR_COLORS));
    expect(new Set(all.map((t) => t.cloth))).toEqual(new Set(CLOTH_COLORS));
    expect(new Set(all.map((t) => t.gender))).toEqual(new Set(["female", "male"]));
    const women = all.filter((t) => t.gender === "female").length / all.length;
    expect(women).toBeGreaterThan(0.4);
    expect(women).toBeLessThan(0.6);
  });

  it("dresses and styles each gender from its own wardrobe", () => {
    const all = ids.map(avatarTraits);
    for (const gender of ["female", "male"] as const) {
      const group = all.filter((t) => t.gender === gender);
      expect(new Set(group.map((t) => t.hairstyle))).toEqual(new Set(HAIRSTYLES[gender]));
      expect(new Set(group.map((t) => t.garment))).toEqual(new Set(GARMENTS[gender]));
    }
    const men = all.filter((t) => t.gender === "male");
    expect(new Set(men.map((t) => t.facialHair))).toEqual(new Set(FACIAL_HAIR));
    expect(all.filter((t) => t.gender === "female").every((t) => t.facialHair === "none")).toBe(
      true,
    );
  });

  it("never trims a garment with its own colour", () => {
    for (const traits of ids.map(avatarTraits)) expect(traits.trim).not.toBe(traits.cloth);
  });

  it("copes with empty and unusual ids", () => {
    expect(avatarTraits("").skin).toMatch(/^#[0-9a-f]{6}$/);
    expect(avatarTraits("p1").hairColor).toMatch(/^#[0-9a-f]{6}$/);
  });
});
