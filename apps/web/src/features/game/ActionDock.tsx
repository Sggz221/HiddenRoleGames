import type {
  GameAction,
  GameActionType,
  PlayerId,
  PlayerView,
  Side,
} from "@howlsinthedark/shared";
import { Check, FastForward, FlaskConical, Hand, Skull } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { allowsNobody, buildAction } from "./model";
import type { ActionController } from "./useActionController";

type T = ReturnType<typeof useTranslation>["t"];

/** Actions only the pack takes: their prompt uses the wolves' typeface. */
const PACK_ACTIONS: ReadonlySet<GameActionType> = new Set([
  "wolfVote",
  "infect",
  "bigBadWolfKill",
  "whiteWolfKill",
]);

interface Props {
  view: PlayerView;
  choice: GameAction | null;
  controller: ActionController;
}

/**
 * What to do now, under the table: the question, the controls that are not avatar taps
 * (confirm, skip, abstain, side, infection, potions) and the current choice.
 */
export function ActionDock({ view, choice, controller }: Props) {
  const { t } = useTranslation();
  const { action, selection, setSelection, send, busy, error } = controller;
  const pending = view.pending;
  const name = (id: PlayerId) => view.players.find((player) => player.id === id)?.name ?? id;

  if (!pending) return <IdleLine view={view} />;
  if (!action && view.phase.kind === "day" && view.phase.step === "debate") {
    return <DebateDock view={view} busy={busy} onReady={() => void send({ type: "skip" })} />;
  }

  const prompt =
    action?.type === "vote" && view.phase.kind === "day" && view.phase.step === "sheriff-election"
      ? t("game.actions.voteSheriff")
      : action
        ? t(`game.actions.${action.type}`)
        : "";
  const pack = action ? PACK_ACTIONS.has(action.type) : false;
  const chosen = describeChoice(choice, name, t);
  // Each potion tap is sent at once: a choice left unconfirmed used to be lost at dawn.
  const brew = (potions: { heal: PlayerId | null; poison: PlayerId | null }) => {
    const next = { ...selection, ...potions };
    setSelection(next);
    void send(buildAction("witch", next));
  };

  return (
    <motion.section
      aria-labelledby="action-title"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3 text-center"
    >
      <h2
        id="action-title"
        className={pack ? "font-wolf text-3xl text-blood" : "font-display text-2xl"}
      >
        {prompt}
      </h2>
      <PhaseHint view={view} />

      {action?.form === "side" && (
        <Choices>
          {(["village", "wolves"] as const satisfies readonly Side[]).map((side) => (
            <Chip
              key={side}
              selected={choice?.type === "wolfHoundChoose" && choice.side === side}
              disabled={busy}
              onClick={() => void send(buildAction("wolfHoundChoose", { targets: [], side }))}
            >
              {t(`game.sides.${side}`)}
            </Chip>
          ))}
        </Choices>
      )}

      {action?.form === "infect" && (
        <Choices>
          {[true, false].map((infect) => (
            <Chip
              key={String(infect)}
              selected={choice?.type === "infect" && choice.infect === infect}
              disabled={busy}
              onClick={() => void send(buildAction("infect", { targets: [], infect }))}
            >
              {infect ? t("game.actions.yes") : t("game.actions.no")}
            </Chip>
          ))}
        </Choices>
      )}

      {action?.form === "witch" && (
        <div className="flex w-full flex-col gap-3">
          <p className="text-ink/75 text-sm">{t("game.actions.witchHint")}</p>
          <PotionRow
            icon={<FlaskConical aria-hidden="true" className="size-4 text-emerald-300" />}
            label={t("game.actions.heal")}
            available={view.you.witchPotions?.heal ?? false}
            options={pending.targets}
            value={selection.heal}
            name={name}
            busy={busy}
            onChange={(heal) => {
              const poison = selection.poison ?? null;
              brew({ heal, poison: heal && poison === heal ? null : poison });
            }}
          />
          <PotionRow
            icon={<Skull aria-hidden="true" className="size-4 text-rose-300" />}
            label={t("game.actions.poison")}
            available={view.you.witchPotions?.poison ?? false}
            options={pending.targets}
            value={selection.poison}
            name={name}
            busy={busy}
            onChange={(poison) => {
              const heal = selection.heal ?? null;
              brew({ poison, heal: poison && heal === poison ? null : heal });
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {(action?.form === "pair" || action?.form === "upToTwo") && (
          <PrimaryButton
            disabled={busy || !buildAction(action.type, selection)}
            onClick={() => action && void send(buildAction(action.type, selection))}
          >
            {t("game.actions.confirm")}
          </PrimaryButton>
        )}
        {action?.form === "target" && allowsNobody(action.type) && (
          <SecondaryButton
            pressed={choice !== null && "target" in choice && choice.target === null}
            disabled={busy}
            onClick={() => void send(buildAction(action.type, { targets: [] }))}
            icon={<Hand aria-hidden="true" className="size-4" />}
          >
            {action.type === "vote" ? t("game.actions.abstain") : t("game.actions.nobody")}
          </SecondaryButton>
        )}
        {pending.types.includes("skip") && (
          <SecondaryButton
            pressed={false}
            disabled={busy}
            onClick={() => void send({ type: "skip" })}
            icon={<FastForward aria-hidden="true" className="size-4" />}
          >
            {t("game.actions.skip")}
          </SecondaryButton>
        )}
      </div>
      <VoteProgress view={view} />

      <AnimatePresence mode="wait">
        {chosen && (
          <motion.p
            key={chosen}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 text-sm"
            aria-live="polite"
          >
            <Check aria-hidden="true" className="size-4 text-[var(--accent)]" />
            {t("game.actions.chosen", { choice: chosen })}
          </motion.p>
        )}
      </AnimatePresence>
      {error && (
        <motion.p
          role="alert"
          initial={{ x: -8 }}
          animate={{ x: [8, -6, 4, 0] }}
          className="text-rose-300 text-sm"
        >
          {error}
        </motion.p>
      )}
      <p className="text-ink-muted text-xs">{t("game.actions.changeHint")}</p>
    </motion.section>
  );
}

/** What to show when there is nothing to do right now. */
function IdleLine({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const { phase } = view;
  let text: string;
  if (view.result) return null;
  if (!view.you.alive) text = t("game.idle.dead");
  else if (phase.kind === "night") text = t("game.idle.night");
  else if (phase.kind === "reaction") {
    const actor = view.players.find((player) => player.id === phase.decision.actor);
    text = t("game.idle.waitingFor", { name: actor?.name ?? "" });
  } else if (phase.kind === "day" && phase.step === "debate") text = t("game.idle.debate");
  else text = t("game.idle.waitingVotes");

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={text}
        initial={{ opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(6px)" }}
        transition={{ duration: 0.5 }}
        className="text-center font-display text-ink/85 text-xl italic"
        aria-live="polite"
      >
        {text}
        <VoteProgress view={view} />
      </motion.p>
    </AnimatePresence>
  );
}

/** Debate: talk, then say you are ready. The vote starts when everyone alive is. */
function DebateDock({
  view,
  busy,
  onReady,
}: {
  view: PlayerView;
  busy: boolean;
  onReady: () => void;
}) {
  const { t } = useTranslation();
  const ready = view.voted.includes(view.you.id);
  return (
    <motion.section
      aria-labelledby="action-title"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3 text-center"
    >
      <h2 id="action-title" className="font-display text-2xl">
        {t("game.idle.debate")}
      </h2>
      <PhaseHint view={view} />
      <PrimaryButton disabled={busy || ready} onClick={onReady}>
        <span className="flex items-center gap-2">
          {ready ? (
            <Check aria-hidden="true" className="size-5" />
          ) : (
            <FastForward aria-hidden="true" className="size-5" />
          )}
          {ready ? t("game.actions.ready") : t("game.actions.readyToVote")}
        </span>
      </PrimaryButton>
      <VoteProgress view={view} />
    </motion.section>
  );
}

/** What this day step means, in one line: nobody should wonder why nobody died. */
function PhaseHint({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  if (view.phase.kind !== "day") return null;
  return <p className="max-w-md text-ink/75 text-sm">{t(`game.hint.${view.phase.step}`)}</p>;
}

/** "3 of 6 have voted" during the day: the step ends early once everyone has. */
function VoteProgress({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  if (view.phase.kind !== "day" || view.result) return null;
  const living = view.players.filter((player) => player.alive).length;
  const key = view.phase.step === "debate" ? "game.progress.ready" : "game.progress.voted";
  return (
    <span className="mt-1 block font-sans text-ink-muted text-sm not-italic" aria-live="polite">
      {t(key, { count: view.voted.length, total: living })}
    </span>
  );
}

function PotionRow({
  icon,
  label,
  available,
  options,
  value,
  name,
  busy,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  available: boolean;
  options: PlayerId[];
  value: PlayerId | null | undefined;
  name: (id: PlayerId) => string;
  busy: boolean;
  onChange: (id: PlayerId | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex flex-col items-center gap-2">
      <legend className="mb-1 flex items-center gap-1.5 font-medium">
        {icon}
        {label}
      </legend>
      {!available ? (
        <p className="text-ink-muted text-sm">{t("game.actions.used")}</p>
      ) : (
        <Choices>
          <Chip selected={!value} disabled={busy} onClick={() => onChange(null)}>
            {t("game.actions.nobody")}
          </Chip>
          {options.map((id) => (
            <Chip key={id} selected={value === id} disabled={busy} onClick={() => onChange(id)}>
              {name(id)}
            </Chip>
          ))}
        </Choices>
      )}
    </fieldset>
  );
}

function Choices({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-2">{children}</div>;
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      className="glass rounded-full px-4 py-2 text-sm transition-colors enabled:hover:border-[var(--accent)] disabled:opacity-60 aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--accent)] aria-pressed:font-semibold aria-pressed:text-[var(--on-accent)]"
    >
      {children}
    </motion.button>
  );
}

function SecondaryButton({
  pressed,
  disabled,
  onClick,
  icon,
  children,
}: {
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className="glass flex items-center gap-2 rounded-full border-2 px-5 py-2.5 font-semibold transition-colors enabled:hover:border-[var(--accent)] disabled:opacity-60 aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--accent)] aria-pressed:text-[var(--on-accent)]"
    >
      {icon}
      {children}
    </motion.button>
  );
}

function PrimaryButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className="rounded-full bg-[var(--accent)] px-6 py-2.5 font-semibold text-[var(--on-accent)] shadow-[0_0_24px_-6px_var(--accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}

function describeChoice(
  choice: GameAction | null,
  name: (id: PlayerId) => string,
  t: T,
): string | null {
  if (!choice) return null;
  switch (choice.type) {
    case "vote":
    case "sheriffTieBreak":
      return choice.target ? name(choice.target) : t("game.actions.nobody");
    case "cupidLink":
    case "piperCharm":
      return choice.targets.map(name).join(", ");
    case "wolfHoundChoose":
      return t(`game.sides.${choice.side}`);
    case "infect":
      return choice.infect ? t("game.actions.yes") : t("game.actions.no");
    case "witch": {
      const parts = [
        choice.heal && `${t("game.actions.heal")}: ${name(choice.heal)}`,
        choice.poison && `${t("game.actions.poison")}: ${name(choice.poison)}`,
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : t("game.actions.nobody");
    }
    case "skip":
      return null;
    default:
      return name(choice.target);
  }
}
