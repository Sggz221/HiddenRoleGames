import type { PlayerId, PlayerView, PublicPlayer } from "@howlsinthedark/shared";
import { Check, Flame, Heart, PawPrint, RotateCw, Sparkles, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { VillagerAvatar } from "../../components/avatar/VillagerAvatar";
import { ClawMark } from "../../components/ClawMark";
import { tally } from "./model";
import { ROLE_ICONS } from "./roleIcons";
import { type LabelSide, layoutTable } from "./tableLayout";
import type { ActionController } from "./useActionController";

/** Seat colour: stable per seat, spread around the wheel. Backdrop of the portrait. */
export const seatColor = (seat: number) => `hsl(${(seat * 47 + 200) % 360} 42% 34%)`;

/** Size before the first measurement (and on the server): a phone-sized table. */
const FALLBACK_SIZE = { width: 320, height: 427 };

/** Dead players whose claw swipe was already drawn: the table remounts every phase. */
const clawsDrawn = new Set<PlayerId>();

/**
 * The round table: one villager portrait per player, in seat order, seat 0 at the top and clockwise.
 * Everyone sees the same table (it never turns towards the viewer), so "the player to your
 * left" means the same for all. When the server lets you pick, the valid targets breathe and
 * a tap chooses; votes land on the circles as dots. Dead players turn grey with a red claw
 * swipe, and hovering (or tapping) them reveals their card if it is known.
 */
export function PlayersTable({
  view,
  controller,
}: {
  view: PlayerView;
  controller: ActionController;
}) {
  const { t } = useTranslation();
  const table = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(table, FALLBACK_SIZE);
  const players = [...view.players].sort((a, b) => a.seat - b.seat);
  // Ballots are secret until the close: the table only shows who is done.
  const done = new Set(view.phase.kind === "day" ? view.voted : []);
  const doneLabel = view.phase.kind === "day" && view.phase.step === "debate" ? "ready" : "voted";
  // Names are 12px on narrow tables and 14px on wide ones; "tú" adds a line.
  const nameSize = width < 600 ? 12 : 14;
  const charWidth = nameSize * 0.55;
  const layout = layoutTable(
    players.length,
    width,
    height,
    players.map((player) => ({
      // "ha votado" (10px) can be wider than a short name.
      width: Math.max(player.name.length * charWidth + 2, done.has(player.id) ? 58 : 0),
      // "tú" and "ha votado"/"listo" each add a short line under the name.
      height: 16 + (player.id === view.you.id ? 12 : 0) + (done.has(player.id) ? 12 : 0),
    })),
  );

  const votes = view.wolfVotes ?? view.votes;
  const groups = tally(votes);
  const votersOf = (id: PlayerId) => groups.find((group) => group.target === id)?.voters ?? [];
  const seatOf = (id: PlayerId) => view.players.find((player) => player.id === id)?.seat ?? 0;
  const alive = players.filter((player) => player.alive).length;

  return (
    <div
      ref={table}
      className="relative mx-auto aspect-[3/4] w-full max-w-md sm:aspect-[8/5] sm:max-w-none"
    >
      <TableCentre alive={alive} total={players.length} night={view.phase.kind === "night"} />
      <ol aria-label={t("game.table.label", { count: players.length })}>
        {players.map((player, index) => {
          const spot = layout.seats[index];
          if (!spot) return null;
          return (
            <motion.li
              key={player.id}
              className="absolute"
              style={{ left: spot.x, top: spot.y, x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 22 }}
            >
              <Avatar
                player={player}
                size={layout.avatar}
                label={spot.label}
                labelWidth={spot.labelWidth}
                nameSize={nameSize}
                isYou={player.id === view.you.id}
                voters={votersOf(player.id).map(seatOf)}
                done={done.has(player.id) ? doneLabel : null}
                pickable={controller.canPick(player.id)}
                picked={controller.isPicked(player.id)}
                onPick={() => controller.pick(player.id)}
              />
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/** The middle of the table: the fire, how many are left and which way the table turns. */
function TableCentre({ alive, total, night }: { alive: number; total: number; night: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <Flame
          aria-hidden="true"
          className={`size-7 ${night ? "text-[var(--accent)]/70" : "text-amber-300/80"}`}
        />
        <p className="font-display text-lg tabular-nums leading-none">
          {alive}/{total}
        </p>
        <p className="text-ink-muted text-xs">{t("game.table.alive")}</p>
        <RotateCw aria-hidden="true" className="mt-1 size-3.5 text-ink-muted/70" />
        <span className="sr-only">{t("game.table.direction")}</span>
      </div>
    </div>
  );
}

/** Where the name (and the dead player's card) sits: towards the centre of the table. */
const LABEL_PLACEMENT: Record<LabelSide, string> = {
  below: "top-full left-1/2 mt-1 -translate-x-1/2 items-center text-center",
  above: "bottom-full left-1/2 mb-1 -translate-x-1/2 items-center text-center",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2 items-end text-right",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2 items-start text-left",
};

function Avatar({
  player,
  size,
  label,
  labelWidth,
  nameSize,
  isYou,
  voters,
  done,
  pickable,
  picked,
  onPick,
}: {
  player: PublicPlayer;
  /** Diameter in px. */
  size: number;
  label: LabelSide;
  labelWidth: number;
  /** Font size of the name, in px (the layout reserved room for it). */
  nameSize: number;
  isYou: boolean;
  /** Seats of the players voting for this one. */
  voters: number[];
  /** Has voted, or (in the debate) is ready to vote; `null` = not yet. */
  done: "voted" | "ready" | null;
  pickable: boolean;
  picked: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const [peek, setPeek] = useState(false);
  const drawClaw = !player.alive && !clawsDrawn.has(player.id);
  useEffect(() => {
    if (!player.alive) clawsDrawn.add(player.id);
  }, [player.alive, player.id]);
  const RoleIcon = player.role ? ROLE_ICONS[player.role] : null;
  const showTip = peek && !player.alive;
  const small = size < 48;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only reveals a tooltip also reachable by focus
    <div
      className="relative"
      style={{ width: size, height: size }}
      onMouseEnter={() => setPeek(true)}
      onMouseLeave={() => setPeek(false)}
    >
      <motion.button
        type="button"
        onClick={pickable ? onPick : () => setPeek(!peek)}
        onFocus={() => setPeek(true)}
        onBlur={() => setPeek(false)}
        aria-pressed={pickable ? picked : undefined}
        aria-label={avatarLabel(t, player, isYou, done)}
        whileTap={pickable ? { scale: 0.9 } : {}}
        animate={pickable && !picked ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={
          pickable && !picked
            ? { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
            : { duration: 0.3 }
        }
        className={`relative flex size-full items-center justify-center rounded-full shadow-lg ring-offset-2 ring-offset-transparent transition-[box-shadow] ${
          picked
            ? "ring-4 ring-[var(--accent)]"
            : pickable
              ? "ring-2 ring-[var(--accent)]/60"
              : player.isWolfAlly
                ? "ring-2 ring-blood"
                : isYou
                  ? "ring-2 ring-[var(--accent)]/40"
                  : "ring-1 ring-white/20"
        } ${pickable ? "cursor-pointer" : "cursor-default"}`}
        style={{
          boxShadow: picked ? "0 0 24px -2px var(--accent)" : undefined,
        }}
      >
        {/* The face turns grey on death; the claw on top keeps its red. */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.25), transparent 55%), ${seatColor(player.seat)}`,
          }}
          animate={{
            filter: player.alive ? "grayscale(0)" : "grayscale(1)",
            opacity: player.alive ? 1 : 0.55,
          }}
          transition={{ duration: 0.6 }}
        >
          <VillagerAvatar id={player.id} className="size-full" />
        </motion.span>

        {!player.alive && (
          <ClawMark className="absolute inset-0 size-full scale-105" draw={drawClaw} />
        )}

        <AnimatePresence>
          {picked && (
            <motion.span
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="absolute -bottom-1 -left-1 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
            >
              <Check aria-hidden="true" className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>

        <span className="absolute -top-1 -left-1 flex gap-0.5">
          {player.isSheriff && (
            <Badge small={small} icon={<Star className="size-full text-amber-300" />} />
          )}
          {player.isWolfAlly && (
            <Badge small={small} icon={<PawPrint className="size-full text-blood" />} />
          )}
          {player.isLover && (
            <Badge small={small} icon={<Heart className="size-full text-pink-300" />} />
          )}
          {player.charmed && (
            <Badge small={small} icon={<Sparkles className="size-full text-violet-300" />} />
          )}
        </span>

        <AnimatePresence>
          {voters.length > 0 && (
            <motion.span
              key={voters.length}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 18 }}
              className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[var(--on-accent)] text-[11px]"
            >
              {voters.length}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <div
        className={`pointer-events-none absolute flex w-max flex-col gap-0.5 ${LABEL_PLACEMENT[label]}`}
        style={{ maxWidth: labelWidth }}
      >
        <span
          className={`max-w-full truncate leading-tight ${player.alive ? "" : "text-ink-muted line-through"}`}
          style={{ fontSize: nameSize }}
        >
          {player.name}
        </span>
        {isYou && (
          <span className="whitespace-nowrap text-[10px] text-[var(--accent)] leading-none">
            {t("game.youShort")}
          </span>
        )}
        {done && (
          <span className="flex items-center gap-0.5 whitespace-nowrap text-[10px] text-emerald-300 leading-none">
            <Check aria-hidden="true" className="size-2.5" />
            {t(`game.players.${done}`)}
          </span>
        )}
        {/* Who voted for this player: one dot per voter, in their seat colour. */}
        {voters.length > 0 && (
          <span className="flex max-w-full flex-wrap gap-0.5">
            <AnimatePresence>
              {voters.map((seat) => (
                <motion.span
                  key={seat}
                  layout
                  initial={{ scale: 0, y: -6 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0 }}
                  className="size-1.5 rounded-full ring-1 ring-black/40"
                  style={{ background: seatColor(seat) }}
                />
              ))}
            </AnimatePresence>
          </span>
        )}
      </div>

      <AnimatePresence>
        {showTip && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`glass-strong absolute z-20 flex w-40 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${LABEL_PLACEMENT[label]}`}
          >
            {RoleIcon && <RoleIcon aria-hidden="true" className="size-5 shrink-0 text-moon" />}
            <span>
              {player.role
                ? t("game.dead", { role: t(`roles.${player.role}`) })
                : t("game.deadUnknown")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ icon, small }: { icon: ReactNode; small: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full bg-black/60 ${small ? "size-4 p-0.5" : "size-5 p-[3px]"}`}
    >
      {icon}
    </span>
  );
}

/** Tracks an element's size (the table is laid out in px from its real box). */
function useElementSize(
  ref: RefObject<HTMLElement | null>,
  fallback: { width: number; height: number },
): { width: number; height: number } {
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function avatarLabel(
  t: ReturnType<typeof useTranslation>["t"],
  player: PublicPlayer,
  isYou: boolean,
  done: "voted" | "ready" | null,
): string {
  const parts = [player.name];
  if (isYou) parts.push(`(${t("game.youShort")})`);
  if (!player.alive)
    parts.push(
      player.role ? t("game.dead", { role: t(`roles.${player.role}`) }) : t("game.players.dead"),
    );
  if (player.isSheriff) parts.push(t("game.players.sheriff"));
  if (done) parts.push(t(`game.players.${done}`));
  if (player.isWolfAlly) parts.push(t("game.players.wolfAlly"));
  if (player.isLover) parts.push(t("game.players.lover"));
  if (player.charmed) parts.push(t("game.players.charmed"));
  return parts.join(", ");
}
