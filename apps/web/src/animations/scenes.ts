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
  /** Deaths during the day: vote, the Hunter's shot, grief. */
  | { kind: "deaths"; deaths: Death[] };

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
  return deaths.length ? [{ kind: "deaths", deaths }] : [];
}
