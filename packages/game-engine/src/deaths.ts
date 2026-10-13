import type { PlayerId, PublicDeathCause } from "@howlsinthedark/shared";
import {
  ALL,
  type DeathCause,
  type Draft,
  findPlayer,
  hasPower,
  isAlive,
  livingNeighbours,
  loverOf,
  to,
  wolfPack,
} from "./state.js";

const PUBLIC_CAUSE: Record<DeathCause, PublicDeathCause> = {
  wolves: "night",
  "big-bad-wolf": "night",
  "white-werewolf": "night",
  poison: "night",
  vote: "vote",
  hunter: "hunter",
  grief: "grief",
  rust: "rust",
};

/** Causes that cost the village its powers when they kill the Elder. */
const VILLAGE_INFLICTED: ReadonlySet<DeathCause> = new Set(["vote", "poison", "hunter"]);

/**
 * Eliminates a player and resolves every chained consequence. Decisions (Hunter shot,
 * Sheriff succession) are queued; the caller moves into the reaction phase afterwards.
 */
export function kill(draft: Draft, id: PlayerId, cause: DeathCause): void {
  const { state } = draft;
  const player = findPlayer(state, id);
  if (!player?.alive) return;

  // Powers are evaluated as they were right before dying.
  const hadPower = hasPower(state, player);
  player.alive = false;

  const reveal = state.config.revealOnDeath;
  draft.emit({
    type: "playerDied",
    player: id,
    cause: PUBLIC_CAUSE[cause],
    ...(reveal === "role" ? { role: player.role, side: player.side } : {}),
    ...(reveal === "side" ? { side: player.side } : {}),
  });

  if (player.side === "wolves") state.wolfHasDied = true;

  if (isAngelVictory(draft, id, cause)) {
    state.result = { team: "angel", winners: [id] };
    return;
  }

  if (player.role === "elder" && VILLAGE_INFLICTED.has(cause) && !state.villagePowersLost) {
    state.villagePowersLost = true;
    draft.emit({ type: "villagePowersLost" });
  }

  if (player.role === "knight" && cause === "wolves" && hadPower) {
    state.rustVictim = firstWolfToTheLeft(draft, id);
  }

  if (player.role === "hunter" && hadPower) {
    state.decisions.push({ kind: "hunter-shot", actor: id });
  }

  if (state.sheriff === id) {
    state.decisions.push({ kind: "sheriff-successor", actor: id });
  }

  transformWildChild(draft, id);

  const lover = loverOf(state, id);
  if (lover && isAlive(state, lover)) kill(draft, lover, "grief");
}

/** The Angel wins if eliminated during the first turn (opening day vote or first night). */
function isAngelVictory(draft: Draft, id: PlayerId, cause: DeathCause): boolean {
  const { state } = draft;
  if (findPlayer(state, id)?.role !== "angel") return false;
  // An Angel in love abandons his goal to survive with his partner.
  if (loverOf(state, id)) return false;
  if (cause === "vote") return state.day === 0;
  return state.day === 1 && (cause === "wolves" || cause === "big-bad-wolf" || cause === "poison");
}

function transformWildChild(draft: Draft, deadId: PlayerId): void {
  const { state } = draft;
  if (state.wildChildModel !== deadId) return;
  const child = state.players.find((player) => player.role === "wild-child");
  if (!child?.alive || child.side === "wolves") return;
  child.side = "wolves";
  draft.emit({ type: "wildChildTransformed" }, to(child.id));
}

/** The first living wolf seated to the Knight's left catches the rust. */
function firstWolfToTheLeft(draft: Draft, knightId: PlayerId): PlayerId | null {
  const { players } = draft.state;
  const seat = players.findIndex((player) => player.id === knightId);
  for (let step = 1; step < players.length; step++) {
    const candidate = players[(seat + step) % players.length];
    if (candidate?.alive && candidate.side === "wolves") return candidate.id;
  }
  return null;
}

/** Resolves everything that happened during the night, in a fixed order. */
export function resolveDawn(draft: Draft): void {
  const { state } = draft;
  const night = state.night;

  if (state.rustVictim) {
    const victim = state.rustVictim;
    state.rustVictim = null;
    if (isAlive(state, victim)) kill(draft, victim, "rust");
  }

  const healed = night.witchHeal;
  for (const [victim, cause] of [
    [night.wolvesVictim, "wolves"],
    [night.bigBadWolfVictim, "big-bad-wolf"],
  ] as const) {
    if (!victim || victim === healed || !isAlive(state, victim)) continue;
    if (victim === night.salvadorTarget) continue;
    if (elderResists(draft, victim)) continue;
    kill(draft, victim, cause);
  }

  if (night.whiteWolfVictim && isAlive(state, night.whiteWolfVictim)) {
    kill(draft, night.whiteWolfVictim, "white-werewolf");
  }
  if (night.witchPoison && isAlive(state, night.witchPoison)) {
    kill(draft, night.witchPoison, "poison");
  }

  growlIfNeeded(draft);
}

/** The Elder survives the first wolf attack. */
function elderResists(draft: Draft, victimId: PlayerId): boolean {
  const { state } = draft;
  const victim = findPlayer(state, victimId);
  if (victim?.role !== "elder" || state.elderLivesLost > 0) return false;
  state.elderLivesLost = 1;
  draft.emit({ type: "elderResisted" }, to(victimId));
  return true;
}

/** Each morning the Bear Tamer's bear growls if a wolf sits next to him (always, if he is infected). */
function growlIfNeeded(draft: Draft): void {
  const { state } = draft;
  const tamer = state.players.find((player) => player.role === "bear-tamer");
  if (!tamer || !hasPower(state, tamer)) return;
  const growls =
    tamer.side === "wolves" ||
    livingNeighbours(state, tamer.id).some((neighbour) => neighbour.side === "wolves");
  if (growls) draft.emit({ type: "bearGrowled" }, ALL);
}

export const packIds = (draft: Draft): PlayerId[] =>
  wolfPack(draft.state).map((player) => player.id);
