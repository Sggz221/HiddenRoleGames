import type { Phase } from "@howlsinthedark/shared";
import { Moon, Sun, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatClock, remainingSeconds } from "./model";

interface Props {
  phase: Phase;
  day: number;
  phaseEndsAt: number | null;
  clockOffset: number;
}

/** Day/night, the current step and the countdown, synchronized with the server's clock. */
export function PhaseBar({ phase, day, phaseEndsAt, clockOffset }: Props) {
  const { t } = useTranslation();
  const night = phase.kind === "night";
  const Icon = night ? Moon : Sun;

  return (
    <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-panel-border border-b bg-sky/90 px-4 py-3 backdrop-blur-md">
      <Icon
        aria-hidden="true"
        className={`size-6 shrink-0 ${night ? "text-moon" : "text-amber-300"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-lg leading-tight">
          {phaseTitle(t, phase, day)}
        </p>
        <p className="truncate text-ink-muted text-sm">{stepTitle(t, phase)}</p>
      </div>
      <Countdown phaseEndsAt={phaseEndsAt} clockOffset={clockOffset} />
    </header>
  );
}

function phaseTitle(t: ReturnType<typeof useTranslation>["t"], phase: Phase, day: number): string {
  if (phase.kind === "ended") return t("game.phase.ended");
  if (phase.kind === "night") return t("game.phase.night", { day });
  return t("game.phase.day", { day });
}

function stepTitle(t: ReturnType<typeof useTranslation>["t"], phase: Phase): string {
  switch (phase.kind) {
    case "night":
      return t(`game.nightStep.${phase.step}`);
    case "day":
      return t(`game.dayStep.${phase.step}`);
    case "reaction":
      return t(`game.reaction.${phase.decision.kind}`);
    case "ended":
      return "";
  }
}

function Countdown({
  phaseEndsAt,
  clockOffset,
}: {
  phaseEndsAt: number | null;
  clockOffset: number;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const seconds = remainingSeconds(phaseEndsAt, now, clockOffset);
  if (seconds === null) return null;
  const urgent = seconds <= 10;
  return (
    // role="timer" is not a live region: assistive tech reads it on demand, not every second.
    <p
      role="timer"
      aria-label={`${t("game.timeLeft")}: ${formatClock(seconds)}`}
      className={`flex items-center gap-1.5 font-mono text-xl tabular-nums ${urgent ? "text-rose-300" : ""}`}
    >
      <Timer aria-hidden="true" className="size-5" />
      <span aria-hidden="true">{formatClock(seconds)}</span>
    </p>
  );
}
