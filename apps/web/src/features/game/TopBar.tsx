import type { Phase, PlayerId, PlayerView } from "@howlsinthedark/shared";
import { Moon, Music, SlidersHorizontal, Sun, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { audioManager } from "../../audio/audioManager";
import { Popover } from "../../components/Popover";
import { VolumeControls } from "../../components/VolumeControls";
import { formatClock, remainingSeconds } from "./model";
import { motionPreference, useReduceMotionSetting } from "./preferences";
import { ROLE_ICONS } from "./roleIcons";
import { roleTheme } from "./roleTheme";

type T = ReturnType<typeof useTranslation>["t"];

interface Props {
  view: PlayerView;
  phaseEndsAt: number | null;
  clockOffset: number;
  /** Hidden while the opening card reveal is on screen (the card flies into the chip). */
  showRole: boolean;
  onReplayReveal: () => void;
}

/** Day and turn, your role, sound and settings, and the clock. */
export function TopBar({ view, phaseEndsAt, clockOffset, showRole, onReplayReveal }: Props) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-3 pt-3 sm:px-6">
      <div className="flex items-center gap-2 sm:order-2">
        <PhasePill phase={view.phase} day={view.day} />
        {showRole ? <RoleChip view={view} /> : <span className="size-12" />}
      </div>
      <div className="ml-auto flex items-center gap-2 sm:order-3 sm:ml-0">
        <AudioButtons />
        <SettingsMenu onReplayReveal={onReplayReveal} />
        <ClockDial phaseEndsAt={phaseEndsAt} clockOffset={clockOffset} />
      </div>
      <span className="hidden sm:order-1 sm:block sm:w-40" />
    </header>
  );
}

function PhasePill({ phase, day }: { phase: Phase; day: number }) {
  const { t } = useTranslation();
  const title = phaseTitle(t, phase, day);
  const step = stepTitle(t, phase);
  return (
    <div className="glass min-w-40 overflow-hidden rounded-2xl px-4 py-2 text-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`${title}|${step}`}
          initial={{ y: 18, opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -18, opacity: 0, filter: "blur(4px)" }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
        >
          <p className="font-display font-semibold text-xl uppercase leading-tight tracking-wider">
            {title}
          </p>
          <p className="text-ink/75 text-sm">{step}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function phaseTitle(t: T, phase: Phase, day: number): string {
  if (phase.kind === "ended") return t("game.phase.ended");
  if (phase.kind === "night") return t("game.phase.night", { day });
  return t("game.phase.day", { day });
}

function stepTitle(t: T, phase: Phase): string {
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

/** Your card as an icon; hover or tap for its objective and what you privately know. */
function RoleChip({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const { you } = view;
  const theme = roleTheme(you.role, you.side);
  const Icon = ROLE_ICONS[you.role];
  const role = t(`roles.${you.role}`);
  return (
    <Popover
      hover
      label={t("game.roleButton", { role })}
      triggerClassName="block"
      panelClassName="w-72 text-left"
      trigger={
        <motion.span
          layoutId="role-card"
          className="glass flex size-12 items-center justify-center rounded-2xl"
          style={{ borderColor: theme.accent, boxShadow: `0 0 18px -4px ${theme.accent}` }}
        >
          <Icon aria-hidden="true" className="size-6" style={{ color: theme.accent }} />
        </motion.span>
      }
    >
      <p className="text-ink-muted text-xs uppercase tracking-widest">{t("game.yourCard")}</p>
      <p
        className={`text-3xl leading-tight ${theme.font === "wolf" ? "font-wolf" : "font-display"}`}
        style={{ color: theme.accent }}
      >
        {role}
      </p>
      <p className="mt-2 text-sm">{t(`roleGoals.${you.role}`)}</p>
      <PrivateFacts view={view} />
    </Popover>
  );
}

/** Lover, sisters, potions, visions... everything only you know. */
function PrivateFacts({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const { you } = view;
  const name = (id: PlayerId) => view.players.find((player) => player.id === id)?.name ?? id;
  const facts: string[] = [];
  if (you.infected) facts.push(t("game.you.infected"));
  if (you.lover) facts.push(t("game.you.lover", { name: name(you.lover) }));
  if (you.sisters.length) {
    facts.push(t("game.you.sisters", { names: you.sisters.map(name).join(", ") }));
  }
  if (you.wildChildModel) {
    facts.push(t("game.you.wildChildModel", { name: name(you.wildChildModel) }));
  }
  if (you.wolfHoundSide) {
    facts.push(t("game.you.wolfHound", { side: t(`game.sides.${you.wolfHoundSide}`) }));
  }
  if (you.witchPotions) {
    const state = (available: boolean) => t(available ? "game.you.available" : "game.you.usedUp");
    facts.push(
      t("game.you.potions", {
        heal: state(you.witchPotions.heal),
        poison: state(you.witchPotions.poison),
      }),
    );
  }
  if (you.foxActive === false) facts.push(t("game.you.foxLost"));
  if (you.charmed) facts.push(t("game.you.charmed"));
  for (const result of you.seerResults) {
    facts.push(
      t("game.you.seerResult", { name: name(result.target), role: t(`roles.${result.role}`) }),
    );
  }
  for (const result of you.foxResults) {
    facts.push(
      t(result.wolfNearby ? "game.you.foxWolf" : "game.you.foxNoWolf", {
        name: name(result.target),
      }),
    );
  }
  if (!facts.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1 border-panel-border border-t pt-3 text-ink/85 text-sm">
      {facts.map((fact) => (
        <li key={fact}>{fact}</li>
      ))}
    </ul>
  );
}

function AudioButtons() {
  const { t } = useTranslation();
  const sfxMuted = useSyncExternalStore(audioManager.subscribe, audioManager.isSfxMuted);
  const musicMuted = useSyncExternalStore(audioManager.subscribe, audioManager.isMusicMuted);
  const button =
    "glass flex size-11 items-center justify-center rounded-full transition-transform active:scale-90 aria-pressed:opacity-50";
  return (
    <>
      <button
        type="button"
        aria-pressed={sfxMuted}
        aria-label={sfxMuted ? t("game.sfxOff") : t("game.sfxOn")}
        onClick={() => audioManager.setSfxMuted(!sfxMuted)}
        className={button}
      >
        {sfxMuted ? (
          <VolumeX aria-hidden="true" className="size-5" />
        ) : (
          <Volume2 aria-hidden="true" className="size-5 text-sky-300" />
        )}
      </button>
      <button
        type="button"
        aria-pressed={musicMuted}
        aria-label={musicMuted ? t("game.musicOff") : t("game.musicOn")}
        onClick={() => audioManager.setMusicMuted(!musicMuted)}
        className={button}
      >
        <Music aria-hidden="true" className={`size-5 ${musicMuted ? "" : "text-violet-300"}`} />
      </button>
    </>
  );
}

function SettingsMenu({ onReplayReveal }: { onReplayReveal: () => void }) {
  const { t } = useTranslation();
  const reduce = useReduceMotionSetting();
  return (
    <Popover
      label={t("game.settings")}
      align="end"
      triggerClassName="glass flex size-11 items-center justify-center rounded-xl transition-transform active:scale-90"
      panelClassName="w-64"
      trigger={<SlidersHorizontal aria-hidden="true" className="size-5" />}
    >
      <VolumeControls className="mb-4 border-panel-border border-b pb-4" />
      <label className="flex items-center justify-between gap-3">
        <span>{t("game.reduceMotion")}</span>
        <input
          type="checkbox"
          checked={reduce}
          onChange={(event) => motionPreference.set(event.target.checked)}
          className="size-5 accent-[var(--accent)]"
        />
      </label>
      <button
        type="button"
        onClick={onReplayReveal}
        className="mt-3 w-full rounded-lg border border-panel-border px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
      >
        {t("game.replayReveal")}
      </button>
    </Popover>
  );
}

/**
 * The dial of the village clock: moon half and sun half, with a hand at the current hour
 * (`--dial-angle`, written by the clock). Under it, the phase countdown; in the last ten
 * seconds the ring beats with a heartbeat, ticking in the last five.
 */
function ClockDial({
  phaseEndsAt,
  clockOffset,
}: {
  phaseEndsAt: number | null;
  clockOffset: number;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotionConfig() ?? false;
  const [now, setNow] = useState(() => Date.now());
  const lastBeat = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const seconds = remainingSeconds(phaseEndsAt, now, clockOffset);
  const urgent = seconds !== null && seconds > 0 && seconds <= 10;

  useEffect(() => {
    if (!urgent || seconds === null || lastBeat.current === seconds) return;
    lastBeat.current = seconds;
    audioManager.playEffect(seconds <= 5 ? "tick" : "heartbeat");
  }, [urgent, seconds]);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <motion.div
        animate={urgent && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={urgent ? { duration: 0.9, repeat: Number.POSITIVE_INFINITY } : {}}
        className={`glass relative size-14 overflow-hidden rounded-full sm:size-16 ${urgent ? "ring-2 ring-rose-400/80" : ""}`}
        role="img"
        aria-label={t("game.timeLeft")}
      >
        <span className="absolute inset-y-0 left-0 w-1/2 bg-indigo-950/60" />
        <span className="absolute inset-y-0 right-0 w-1/2 bg-amber-200/15" />
        <Moon
          aria-hidden="true"
          className="absolute top-1/2 left-1.5 size-4 -translate-y-1/2 text-moon"
        />
        <Sun
          aria-hidden="true"
          className="absolute top-1/2 right-1.5 size-4 -translate-y-1/2 text-amber-300"
        />
        <span className="absolute inset-x-1/2 top-1 bottom-1 w-px -translate-x-1/2 bg-white/25" />
        <span
          className="absolute bottom-1/2 left-1/2 h-[42%] w-0.5 origin-bottom rounded-full bg-rose-300"
          style={{ transform: "translateX(-50%) rotate(var(--dial-angle, 0deg))" }}
        />
        <span className="absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full bg-rose-300" />
      </motion.div>
      {seconds !== null && (
        <span
          role="timer"
          aria-label={`${t("game.timeLeft")}: ${formatClock(seconds)}`}
          className={`font-mono text-sm tabular-nums ${urgent ? "text-rose-300" : "text-ink/80"}`}
        >
          {formatClock(seconds)}
        </span>
      )}
    </div>
  );
}
