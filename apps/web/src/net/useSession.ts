import { useSyncExternalStore } from "react";
import { session } from "./client";
import type { SessionState } from "./session";

/** The player's seat, re-rendering on every change pushed by the server. */
export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState);
}
