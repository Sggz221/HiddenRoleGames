import { ROLE_IDS } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import { roleTheme } from "./roleTheme";

describe("roleTheme", () => {
  it("every role has a theme with a hex accent", () => {
    for (const role of ROLE_IDS) {
      expect(roleTheme(role, "village").accent).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("the pack is red and gothic, including anyone who joined it", () => {
    expect(roleTheme("werewolf", "wolves")).toMatchObject({ accent: "#e0323f", font: "wolf" });
    // Infected villager, transformed Wild Child, Wolf Hound who chose the pack.
    expect(roleTheme("seer", "wolves").font).toBe("wolf");
    expect(roleTheme("wild-child", "wolves").font).toBe("wolf");
  });

  it("the village keeps the body font with a colour of its own", () => {
    const seer = roleTheme("seer", "village");
    expect(seer.font).toBe("body");
    expect(seer.accent).not.toBe(roleTheme("witch", "village").accent);
  });
});
