import type { GameAction, PendingAction, PlayerView } from "@howlsinthedark/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import "../../i18n";
import { ActionDock } from "./ActionDock";
import { PlayersTable } from "./PlayersTable";
import { useActionController } from "./useActionController";

const players = ["Ana", "Bea", "Carla", "Dani"].map((name, seat) => ({
  id: `p${seat}`,
  name,
  seat,
  alive: seat !== 3,
  isSheriff: false,
  ...(seat === 3 ? { role: "seer" as const } : {}),
}));

/** A view with just what the table and the dock read. */
function view(pending: PendingAction | null, extra: Partial<PlayerView> = {}): PlayerView {
  return {
    day: 1,
    phase: { kind: "night", step: "seer" },
    players,
    pending,
    votes: {},
    voted: [],
    wolfVotes: null,
    result: null,
    you: { id: "p0", alive: true, witchPotions: null },
    ...extra,
  } as PlayerView;
}

function Area({ v, choice }: { v: PlayerView; choice: GameAction | null }) {
  const controller = useActionController(v, choice, async () => ({ ok: true }));
  return (
    <>
      <PlayersTable view={v} controller={controller} />
      <ActionDock view={v} choice={choice} controller={controller} />
    </>
  );
}

const render = (v: PlayerView, choice: GameAction | null = null) =>
  renderToStaticMarkup(<Area v={v} choice={choice} />);

/** The avatar buttons that are pickable right now (they expose aria-pressed). */
const pickable = (html: string) =>
  [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*aria-label="([^"]+)"/g)].map(
    (match) => match[2]?.split(",")[0],
  );

describe("game action area", () => {
  it("only the server's targets are pickable, and skip is offered when allowed", () => {
    const html = render(view({ types: ["seerInspect", "skip"], targets: ["p1", "p2"] }));
    expect(html).toContain("¿De quién quieres ver la carta?");
    expect(pickable(html)).toEqual(["Bea", "Carla"]);
    expect(html).toContain("Pasar");
  });

  it("day votes can abstain, mark the current choice and count who is done", () => {
    const html = render(
      view(
        { types: ["vote"], targets: ["p1", "p2"] },
        { phase: { kind: "day", step: "vote" }, votes: { p0: "p2" }, voted: ["p0", "p1"] },
      ),
      { type: "vote", target: "p2" },
    );
    expect(html).toContain("Abstenerme");
    expect(html).toContain("Has elegido: Carla");
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Carla/);
    expect(html).toContain("2 de 3 han votado");
    expect(html).toContain("Los votos se revelan al final");
  });

  it("the debate offers a clear button to go to the vote, and counts who is ready", () => {
    const debate = { phase: { kind: "day", step: "debate" } } as const;
    let html = render(view({ types: ["skip"], targets: [] }, { ...debate, voted: ["p1"] }));
    expect(html).toContain("Listo para votar");
    expect(html).toContain("1 de 3 listos para votar");
    html = render(view({ types: ["skip"], targets: [] }, { ...debate, voted: ["p0", "p1"] }));
    expect(html).toContain("Listo. Esperando al resto");
  });

  it("the sheriff election says it eliminates nobody", () => {
    const html = render(
      view(
        { types: ["vote"], targets: ["p0", "p1", "p2"] },
        { phase: { kind: "day", step: "sheriff-election" } },
      ),
    );
    expect(html).toContain("¿Quién debe ser el alguacil?");
    expect(html).toContain("no elimina a nadie");
  });

  it("the pack's prompt uses the wolves' typeface", () => {
    const html = render(
      view({ types: ["wolfVote"], targets: ["p1"] }, { phase: { kind: "night", step: "wolves" } }),
    );
    expect(html).toMatch(/class="font-wolf[^"]*"[^>]*>¿A quién devora la manada\?/);
  });

  it("Cupid picks two on the table and confirms in the dock", () => {
    const html = render(view({ types: ["cupidLink", "skip"], targets: ["p0", "p1", "p2"] }));
    expect(pickable(html)).toEqual(["Ana", "Bea", "Carla"]);
    expect(html).toContain("Confirmar");
  });

  it("the Witch chooses potions in the dock, for any living player, without knowing the victim", () => {
    const html = render(
      view(
        { types: ["witch", "skip"], targets: ["p0", "p1", "p2"] },
        {
          you: {
            id: "p0",
            alive: true,
            witchPotions: { heal: true, poison: false },
          } as PlayerView["you"],
        },
      ),
    );
    expect(pickable(html)).toEqual([]);
    expect(html).toContain("Poción de vida");
    expect(html).toContain("No sabes a quién han atacado");
    for (const name of ["Ana", "Bea", "Carla"]) expect(html).toContain(`>${name}</button>`);
    expect(html).toContain("Ya la has usado.");
    expect(html).not.toContain("Confirmar");
  });

  it("with nothing to do, says what is going on; the dead show their known card", () => {
    const html = render(view(null));
    expect(html).toContain("La aldea duerme");
    expect(html).toContain("Dani, Muerto: Vidente");
  });
});
