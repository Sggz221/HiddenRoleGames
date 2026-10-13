import { Music, Volume2 } from "lucide-react";
import { type ReactNode, useId, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { audioManager } from "../audio/audioManager";

/** One slider per audio channel (music and effects); remembered on this device. */
export function VolumeControls({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const music = useSyncExternalStore(audioManager.subscribe, audioManager.getMusicVolume);
  const effects = useSyncExternalStore(audioManager.subscribe, audioManager.getSfxVolume);
  const musicMuted = useSyncExternalStore(audioManager.subscribe, audioManager.isMusicMuted);
  const sfxMuted = useSyncExternalStore(audioManager.subscribe, audioManager.isSfxMuted);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <Slider
        icon={<Music aria-hidden="true" className="size-4 text-violet-300" />}
        label={t("audio.music")}
        value={musicMuted ? 0 : music}
        onChange={(level) => audioManager.setMusicVolume(level)}
      />
      <Slider
        icon={<Volume2 aria-hidden="true" className="size-4 text-sky-300" />}
        label={t("audio.effects")}
        value={sfxMuted ? 0 : effects}
        onChange={(level) => audioManager.setSfxVolume(level)}
      />
    </div>
  );
}

function Slider({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  onChange: (level: number) => void;
}) {
  const id = useId();
  const percent = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-mono text-ink-muted text-xs tabular-nums">{percent}%</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="w-full accent-[var(--accent,#f4e9c8)]"
      />
    </div>
  );
}
