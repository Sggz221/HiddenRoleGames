import type { GameEvent, Phase } from "@howlsinthedark/shared";

export type MusicId = "night" | "day" | "vote";
export type EffectId = "howl" | "death" | "dawn" | "vote-cast";

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
export function effectForEvent(event: GameEvent, previous: Phase | null): EffectId | null {
  switch (event.type) {
    case "playerDied":
      return "death";
    case "voteCast":
      return "vote-cast";
    case "phaseChanged":
      if (event.phase.kind === "night" && previous?.kind !== "night") return "howl";
      if (event.phase.kind === "day" && previous?.kind === "night") return "dawn";
      return null;
    default:
      return null;
  }
}
