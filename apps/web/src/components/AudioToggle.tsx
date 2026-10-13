import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { audioManager } from "../audio/audioManager";

/** Mute switch for music and effects; remembers the choice between visits. */
export function AudioToggle() {
  const { t } = useTranslation();
  const muted = useSyncExternalStore(
    (listener) => audioManager.subscribe(listener),
    () => audioManager.isMuted(),
  );

  return (
    <button
      type="button"
      aria-pressed={muted}
      onClick={() => audioManager.setMuted(!muted)}
      className="rounded-lg border border-panel-border px-4 py-2 text-ink-muted text-sm transition-colors hover:text-ink"
    >
      {muted ? t("audio.unmute") : t("audio.mute")}
    </button>
  );
}
