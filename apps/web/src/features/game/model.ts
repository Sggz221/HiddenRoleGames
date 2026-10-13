import type {
  GameAction,
  GameActionType,
  PendingAction,
  PlayerId,
  Side,
} from "@howlsinthedark/shared";

/** Whole seconds left in the phase by the server's clock (`offset` = server - local). */
export function remainingSeconds(
  phaseEndsAt: number | null,
  now: number,
  offset: number,
): number | null {
  if (phaseEndsAt === null) return null;
  return Math.max(0, Math.ceil((phaseEndsAt - (now + offset)) / 1000));
}

export const formatClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Who voted for whom, grouped by target (`null` = abstained), most voted first. */
export function tally(
  votes: Record<PlayerId, PlayerId | null>,
): { target: PlayerId | null; voters: PlayerId[] }[] {
  const groups = new Map<PlayerId | null, PlayerId[]>();
  for (const [voter, target] of Object.entries(votes)) {
    groups.set(target, [...(groups.get(target) ?? []), voter]);
  }
  return [...groups]
    .map(([target, voters]) => ({ target, voters }))
    .sort((a, b) => b.voters.length - a.voters.length);
}

/**
 * How the player answers each kind of action:
 * - `target`: pick one player (sent at once; picking again changes the choice).
 * - `pair`: pick exactly two (Cupid). `upToTwo`: one or two (Piper).
 * - `side`: village or wolves (Wolf Hound). `infect`: yes or no.
 * - `witch`: optional heal and optional poison, sent together.
 */
export type ActionForm = "target" | "pair" | "upToTwo" | "side" | "infect" | "witch";

const FORMS: Record<Exclude<GameActionType, "skip">, ActionForm> = {
  vote: "target",
  seerInspect: "target",
  wildChildModel: "target",
  salvadorProtect: "target",
  wolfVote: "target",
  bigBadWolfKill: "target",
  whiteWolfKill: "target",
  foxSniff: "target",
  hunterShoot: "target",
  sheriffSuccessor: "target",
  sheriffTieBreak: "target",
  cupidLink: "pair",
  piperCharm: "upToTwo",
  wolfHoundChoose: "side",
  infect: "infect",
  witch: "witch",
};

/** The main action of a pending prompt (`skip` is offered separately). */
export function mainAction(
  pending: PendingAction,
): { type: Exclude<GameActionType, "skip">; form: ActionForm } | null {
  const type = pending.types.find((candidate) => candidate !== "skip");
  return type ? { type, form: FORMS[type] } : null;
}

/** Actions that accept "nobody" (abstain in a vote, no tie-break). */
export const allowsNobody = (type: GameActionType): boolean =>
  type === "vote" || type === "sheriffTieBreak";

/** What the player has picked so far in the action panel. */
export interface Selection {
  targets: PlayerId[];
  side?: Side;
  infect?: boolean;
  heal?: PlayerId | null;
  poison?: PlayerId | null;
}

/** Turns a selection into the action to send, or `null` while it is incomplete. */
export function buildAction(
  type: Exclude<GameActionType, "skip">,
  selection: Selection,
): GameAction | null {
  const [first, second] = selection.targets;
  switch (FORMS[type]) {
    case "target":
      // Every "target" type has the shape { type, target }; TS cannot narrow the union by FORMS.
      if (first !== undefined) return { type, target: first } as GameAction;
      return allowsNobody(type) ? ({ type, target: null } as GameAction) : null;
    case "pair":
      return first && second ? { type: "cupidLink", targets: [first, second] } : null;
    case "upToTwo":
      return first ? { type: "piperCharm", targets: selection.targets.slice(0, 2) } : null;
    case "side":
      return selection.side ? { type: "wolfHoundChoose", side: selection.side } : null;
    case "infect":
      return selection.infect === undefined ? null : { type: "infect", infect: selection.infect };
    case "witch":
      return { type: "witch", heal: selection.heal ?? null, poison: selection.poison ?? null };
  }
}

/** Adds or removes a player from a multi-pick, keeping at most `max` (oldest dropped). */
export function toggleTarget(targets: PlayerId[], id: PlayerId, max: number): PlayerId[] {
  if (targets.includes(id)) return targets.filter((target) => target !== id);
  return [...targets, id].slice(-max);
}
