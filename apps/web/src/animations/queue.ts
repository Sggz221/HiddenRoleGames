import type { Scene } from "./scenes";

/** Plays scenes one after another. Purely visual: the game state never waits for it. */
export class SceneQueue {
  private scenes: Scene[] = [];
  private readonly listeners = new Set<() => void>();

  push(scenes: readonly Scene[]): void {
    if (!scenes.length) return;
    this.scenes = [...this.scenes, ...scenes];
    this.emit();
  }

  /** The scene on screen, if any. */
  current = (): Scene | null => this.scenes[0] ?? null;

  /** Finishes (or skips) the current scene. */
  next(): void {
    if (!this.scenes.length) return;
    this.scenes = this.scenes.slice(1);
    this.emit();
  }

  clear(): void {
    if (!this.scenes.length) return;
    this.scenes = [];
    this.emit();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
