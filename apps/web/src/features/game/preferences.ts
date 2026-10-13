import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "../../net/storage";

const KEY = "howlsinthedark.reduceMotion";

/**
 * "Reduce animations", on top of the system's `prefers-reduced-motion` (which is always
 * respected). Remembered on this device.
 */
class MotionPreference {
  private value = readStored(KEY) === "1";
  private readonly listeners = new Set<() => void>();

  get = (): boolean => this.value;

  set(value: boolean): void {
    this.value = value;
    writeStored(KEY, value ? "1" : "0");
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const motionPreference = new MotionPreference();

export function useReduceMotionSetting(): boolean {
  return useSyncExternalStore(motionPreference.subscribe, motionPreference.get);
}
