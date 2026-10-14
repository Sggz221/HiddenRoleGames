import { healthResponseSchema } from "@howlsinthedark/shared";
import { useEffect, useState } from "react";

export type ServerStatus = "checking" | "online" | "offline";

const POLL_INTERVAL_MS = 30_000;

/** Polls the server healthcheck so the UI can show whether the backend is reachable. */
export function useServerHealth(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch("/health", { cache: "no-store" });
        const ok = response.ok && healthResponseSchema.safeParse(await response.json()).success;
        if (!cancelled) setStatus(ok ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    void check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return status;
}
