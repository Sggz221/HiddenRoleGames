import type { GameEventPayload, Phase } from "@howlsinthedark/shared";
import { Howl } from "howler";
import {
  EFFECTS,
  type EffectId,
  effectForEvent,
  MUSIC,
  type MusicId,
  musicForPhase,
  parseLevel,
} from "./catalog";

const MUSIC_KEY = "howlsinthedark.audio.musicMuted";
const SFX_KEY = "howlsinthedark.audio.sfxMuted";
/** Before music and effects were separate, one key muted everything. */
const LEGACY_KEY = "howlsinthedark.audio.muted";
const MUSIC_LEVEL_KEY = "howlsinthedark.audio.musicVolume";
const SFX_LEVEL_KEY = "howlsinthedark.audio.sfxVolume";
const FADE_MS = 1200;

function readFlag(key: string): boolean {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value === null || value === undefined
      ? globalThis.localStorage?.getItem(LEGACY_KEY) === "1"
      : value === "1";
  } catch {
    return false; // Storage can be blocked (private mode); audio just defaults to on.
  }
}

function writeFlag(key: string, value: boolean): void {
  writeValue(key, value ? "1" : "0");
}

function readLevel(key: string): number {
  try {
    return parseLevel(globalThis.localStorage?.getItem(key));
  } catch {
    return parseLevel(null);
  }
}

function writeValue(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Not persisting the preference is harmless.
  }
}

/**
 * Plays phase music (cross-faded loops) and one-shot effects with Howler, each channel with
 * its own volume (0-1, scaling every asset's own level) and mute. Howler defers playback until the first user gesture, so calling it early is safe.
 * Assets load lazily the first time they are needed.
 */
export class AudioManager {
  private musicMuted = readFlag(MUSIC_KEY);
  private sfxMuted = readFlag(SFX_KEY);
  private musicLevel = readLevel(MUSIC_LEVEL_KEY);
  private sfxLevel = readLevel(SFX_LEVEL_KEY);
  private readonly music = new Map<MusicId, Howl>();
  private readonly effects = new Map<EffectId, Howl>();
  private currentMusic: MusicId | null = null;
  private lastPhase: Phase | null = null;
  private listeners = new Set<() => void>();

  isMusicMuted = (): boolean => this.musicMuted;
  isSfxMuted = (): boolean => this.sfxMuted;
  getMusicVolume = (): number => this.musicLevel;
  getSfxVolume = (): number => this.sfxLevel;
  /** Everything silent (the single switch in the lobby). */
  isMuted = (): boolean => this.musicMuted && this.sfxMuted;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    writeFlag(MUSIC_KEY, muted);
    for (const howl of this.music.values()) howl.mute(muted);
    this.emit();
  }

  setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
    writeFlag(SFX_KEY, muted);
    this.emit();
  }

  /** Music level (0-1). Raising it from a muted channel unmutes it. */
  setMusicVolume(level: number): void {
    this.musicLevel = Math.min(1, Math.max(0, level));
    writeValue(MUSIC_LEVEL_KEY, String(this.musicLevel));
    const playing = this.currentMusic ? this.music.get(this.currentMusic) : undefined;
    if (playing && this.currentMusic) playing.volume(this.musicTarget(this.currentMusic));
    if (this.musicMuted && this.musicLevel > 0) this.setMusicMuted(false);
    else this.emit();
  }

  /** Effects level (0-1). Raising it from a muted channel unmutes it. */
  setSfxVolume(level: number): void {
    this.sfxLevel = Math.min(1, Math.max(0, level));
    writeValue(SFX_LEVEL_KEY, String(this.sfxLevel));
    if (this.sfxMuted && this.sfxLevel > 0) this.setSfxMuted(false);
    else this.emit();
  }

  setMuted(muted: boolean): void {
    this.setMusicMuted(muted);
    this.setSfxMuted(muted);
  }

  /** Follows the game: switches the background track when the phase category changes. */
  setPhase(phase: Phase): void {
    this.lastPhase = phase;
    this.playMusic(musicForPhase(phase));
  }

  /** Reacts to server events (deaths, dawn, nightfall...). */
  handleEvents(events: readonly GameEventPayload[]): void {
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
    if (this.sfxMuted || this.sfxLevel === 0) return;
    let howl = this.effects.get(id);
    if (!howl) {
      howl = new Howl({ src: [EFFECTS[id].src] });
      this.effects.set(id, howl);
    }
    howl.volume(EFFECTS[id].volume * this.sfxLevel);
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
      howl = new Howl({ src: [MUSIC[id].src], loop: true, volume: 0, mute: this.musicMuted });
      this.music.set(id, howl);
    }
    howl.play();
    howl.fade(0, this.musicTarget(id), FADE_MS);
  }

  private musicTarget(id: MusicId): number {
    return MUSIC[id].volume * this.musicLevel;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const audioManager = new AudioManager();
