import type { GameEvent, Phase } from "@howlsinthedark/shared";
import { Howl, Howler } from "howler";
import {
  EFFECTS,
  type EffectId,
  effectForEvent,
  MUSIC,
  type MusicId,
  musicForPhase,
} from "./catalog";

const STORAGE_KEY = "howlsinthedark.audio.muted";
const FADE_MS = 1200;

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // Storage can be blocked (private mode); audio just defaults to on.
  }
}

/**
 * Plays phase music (cross-faded loops) and one-shot effects with Howler. Howler defers the
 * actual playback until the first user gesture, so calling it before interaction is safe.
 * Assets load lazily the first time they are needed.
 */
export class AudioManager {
  private muted = readMuted();
  private readonly music = new Map<MusicId, Howl>();
  private readonly effects = new Map<EffectId, Howl>();
  private currentMusic: MusicId | null = null;
  private lastPhase: Phase | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    Howler.mute(this.muted);
  }

  isMuted(): boolean {
    return this.muted;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // Not persisting the preference is harmless.
    }
    for (const listener of this.listeners) listener();
  }

  /** Follows the game: switches the background track when the phase category changes. */
  setPhase(phase: Phase): void {
    this.lastPhase = phase;
    this.playMusic(musicForPhase(phase));
  }

  /** Reacts to server events (deaths, dawn, nightfall...). */
  handleEvents(events: readonly GameEvent[]): void {
    let previous = this.lastPhase;
    for (const event of events) {
      const effect = effectForEvent(event, previous);
      if (effect) this.playEffect(effect);
      if (event.type === "phaseChanged") {
        previous = event.phase;
        this.setPhase(event.phase);
      }
    }
  }

  stop(): void {
    this.playMusic(null);
    this.lastPhase = null;
  }

  playEffect(id: EffectId): void {
    let howl = this.effects.get(id);
    if (!howl) {
      const { src, volume } = EFFECTS[id];
      howl = new Howl({ src: [src], volume });
      this.effects.set(id, howl);
    }
    howl.play();
  }

  private playMusic(id: MusicId | null): void {
    if (id === this.currentMusic) return;
    const outgoing = this.currentMusic ? this.music.get(this.currentMusic) : undefined;
    if (outgoing) {
      outgoing.fade(outgoing.volume(), 0, FADE_MS);
      outgoing.once("fade", () => outgoing.stop());
    }
    this.currentMusic = id;
    if (!id) return;

    let howl = this.music.get(id);
    if (!howl) {
      howl = new Howl({ src: [MUSIC[id].src], loop: true, volume: 0 });
      this.music.set(id, howl);
    }
    howl.play();
    howl.fade(0, MUSIC[id].volume, FADE_MS);
  }
}

export const audioManager = new AudioManager();
