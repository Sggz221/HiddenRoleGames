import type { GameEventPayload, Phase } from "@howlsinthedark/shared";

export type MusicId = "night" | "day" | "vote";
export type EffectId =
  | "howl"
  | "death"
  | "dawn"
  | "vote-cast"
  | "heartbeat"
  | "tick"
  | "bell"
  | "growl"
  | "card-flip"
  | "stinger-win"
  | "stinger-lose"
  | "ui-open"
  | "ui-close"
  | "select"
  | "chat-pop";

/** Where each asset lives (under `public/`) and how loud it plays. Licences: docs/art-and-sound.md. */
export const MUSIC: Readonly<Record<MusicId, { src: string; volume: number }>> = {
  night: { src: "/audio/ambient-night.wav", volume: 0.5 },
  day: { src: "/audio/ambient-day.wav", volume: 0.4 },
  vote: { src: "/audio/ambient-vote.wav", volume: 0.45 },
};

export const EFFECTS: Readonly<Record<EffectId, { src: string; volume: number }>> = {
  howl: { src: "/audio/howl.wav", volume: 0.7 },
  death: { src: "/audio/death.wav", volume: 0.8 },
  dawn: { src: "/audio/dawn.wav", volume: 0.6 },
  "vote-cast": { src: "/audio/vote-cast.wav", volume: 0.5 },
  heartbeat: { src: "/audio/heartbeat.wav", volume: 0.8 },
  tick: { src: "/audio/tick.wav", volume: 0.5 },
  bell: { src: "/audio/bell.wav", volume: 0.6 },
  growl: { src: "/audio/growl.wav", volume: 0.6 },
  "card-flip": { src: "/audio/card-flip.wav", volume: 0.7 },
  "stinger-win": { src: "/audio/stinger-win.wav", volume: 0.7 },
  "stinger-lose": { src: "/audio/stinger-lose.wav", volume: 0.7 },
  "ui-open": { src: "/audio/ui-open.wav", volume: 0.35 },
  "ui-close": { src: "/audio/ui-close.wav", volume: 0.3 },
  select: { src: "/audio/select.wav", volume: 0.45 },
  "chat-pop": { src: "/audio/chat-pop.wav", volume: 0.4 },
};

/** Background track for a phase (`null` = silence). */
export function musicForPhase(phase: Phase): MusicId | null {
  switch (phase.kind) {
    case "night":
      return "night";
    case "day":
      return phase.step === "vote" || phase.step === "runoff" ? "vote" : "day";
    case "reaction":
      return "vote";
    case "ended":
      return null;
  }
}

/** One-shot effect for a server event, if it has one. */
export function effectForEvent(event: GameEventPayload, previous: Phase | null): EffectId | null {
  switch (event.type) {
    case "playerDied":
      // Night deaths toll at dawn; daytime deaths (vote, shot, grief) hit harder.
      return event.cause === "night" || event.cause === "rust" ? "bell" : "death";
    case "voteCast":
      return "vote-cast";
    case "phaseChanged":
      if (event.phase.kind === "night" && previous?.kind !== "night") return "howl";
      if (event.phase.kind === "night" && event.phase.step === "wolves") return "growl";
      if (event.phase.kind === "day" && previous?.kind === "night") return "dawn";
      return null;
    default:
      return null;
  }
}

/** Default level of each channel (music, effects) before the player moves its slider. */
export const DEFAULT_LEVEL = 1;

/** A stored channel level (0-1), or the default when missing or malformed. */
export function parseLevel(value: string | null | undefined): number {
  if (value === null || value === undefined || value.trim() === "") return DEFAULT_LEVEL;
  const level = Number(value);
  return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : DEFAULT_LEVEL;
}
