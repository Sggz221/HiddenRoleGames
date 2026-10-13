import type { GameAction, PendingAction, PlayerView } from "@howlsinthedark/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import "../../i18n";
import { ActionPanel } from "./ActionPanel";

const players = ["Ana", "Bea", "Carla", "Dani"].map((name, seat) => ({
  id: `p${seat}`,
  name,
  seat,
  alive: true,
  isSheriff: false,
}));

/** A view with just what the panel reads. */
function view(pending: PendingAction | null, extra: Partial<PlayerView> = {}): PlayerView {
  return {
    day: 1,
    phase: { kind: "night", step: "seer" },
    players,
    pending,
    nightVictims: null,
    you: { id: "p0", witchPotions: null },
    ...extra,
  } as PlayerView;
}

const render = (v: PlayerView, choice: GameAction | null = null) =>
  renderToStaticMarkup(
    <ActionPanel view={v} choice={choice} onSend={async () => ({ ok: true })} />,
  );

describe("ActionPanel", () => {
  it("renders nothing when there is nothing to do", () => {
    expect(render(view(null))).toBe("");
  });

  it("offers exactly the server's targets, plus skip when allowed", () => {
    const html = render(view({ types: ["seerInspect", "skip"], targets: ["p1", "p2"] }));
    expect(html).toContain("¿De quién quieres ver la carta?");
    expect(html).toContain("Bea");
    expect(html).toContain("Carla");
    expect(html).not.toContain("Dani");
    expect(html).toContain("Pasar");
  });

  it("day votes can abstain and show the current choice", () => {
    const html = render(
      view({ types: ["vote"], targets: ["p1", "p2"] }, { phase: { kind: "day", step: "vote" } }),
      { type: "vote", target: "p2" },
    );
    expect(html).toContain("Abstenerme");
    expect(html).toContain("Has elegido: Carla");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Carla</);
  });

  it("the sheriff election has its own question", () => {
    const html = render(
      view(
        { types: ["vote"], targets: ["p1"] },
        { phase: { kind: "day", step: "sheriff-election" } },
      ),
    );
    expect(html).toContain("¿Quién debe ser el alguacil?");
  });

  it("Cupid picks two and confirms", () => {
    const html = render(view({ types: ["cupidLink", "skip"], targets: ["p0", "p1", "p2"] }));
    expect(html).toContain("Elige a los dos enamorados.");
    expect(html).toContain("Confirmar");
  });

  it("the Wolf Hound chooses a side and the Infected Father answers yes or no", () => {
    expect(render(view({ types: ["wolfHoundChoose"], targets: [] }))).toContain("Con la manada");
    const infect = render(view({ types: ["infect", "skip"], targets: [] }));
    expect(infect).toContain("Sí, infectar");
    expect(infect).toContain("No");
  });

  it("the Witch sees tonight's victims to heal and anyone to poison", () => {
    const html = render(
      view(
        { types: ["witch", "skip"], targets: ["p1", "p2", "p3"] },
        {
          nightVictims: ["p3"],
          you: { witchPotions: { heal: true, poison: false } } as PlayerView["you"],
        },
      ),
    );
    expect(html).toContain("Poción de vida");
    expect(html).toContain("Dani");
    expect(html).toContain("Ya la has usado.");
  });
});
