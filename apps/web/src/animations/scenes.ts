import type {
  GameEventPayload,
  PlayerId,
  PublicDeathCause,
  RoleId,
  Side,
} from "@howlsinthedark/shared";

export interface Death {
  player: PlayerId;
  cause: PublicDeathCause;
  role?: RoleId;
  side?: Side;
}

/**
 * Something worth stopping the screen for. The game never waits for scenes: they replay
 * events the state already reflects, so skipping (or disabling) them loses nothing.
 */
export type Scene =
  /** The night is over: who died in it (maybe nobody). */
  | { kind: "dawn"; deaths: Death[] }
  /** A day vote closed: who is out right now (and who follows them), or why nobody is. */
  | { kind: "vote"; outcome: VoteOutcome; tied: PlayerId[]; deaths: Death[] }
  /** The village chose its Sheriff (or nobody). */
  | { kind: "sheriff"; player: PlayerId | null; deaths: Death[] }
  /** Other deaths during the day: the Hunter's shot, grief. */
  | { kind: "deaths"; deaths: Death[] };

export type VoteOutcome = "eliminated" | "nobody" | "tie" | "runoff";

/** How a closed vote ended, from the events that announce it. */
function voteOutcome(
  events: readonly GameEventPayload[],
): { outcome: VoteOutcome; tied: PlayerId[] } | null {
  for (const event of events) {
    if (event.type === "runoffStarted") return { outcome: "runoff", tied: event.candidates };
    if (event.type === "voteResult") {
      if (event.eliminated) return { outcome: "eliminated", tied: [] };
      return event.tied.length > 1
        ? { outcome: "tie", tied: event.tied }
        : { outcome: "nobody", tied: [] };
    }
  }
  return null;
}

/** The scenes one batch of events (as the player received them) should play. */
export function scenesFor(events: readonly GameEventPayload[]): Scene[] {
  const deaths: Death[] = events.flatMap((event) =>
    event.type === "playerDied"
      ? [
          {
            player: event.player,
            cause: event.cause,
            ...(event.role ? { role: event.role } : {}),
            ...(event.side ? { side: event.side } : {}),
          },
        ]
      : [],
  );
  if (events.some((event) => event.type === "dawn")) return [{ kind: "dawn", deaths }];
  const vote = voteOutcome(events);
  if (vote) return [{ kind: "vote", ...vote, deaths }];
  const elected = events.find((event) => event.type === "sheriffElected");
  if (elected?.type === "sheriffElected")
    return [{ kind: "sheriff", player: elected.player, deaths }];
  return deaths.length ? [{ kind: "deaths", deaths }] : [];
}
