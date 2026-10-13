import type { PlayerId, PlayerView, PublicPlayer } from "@howlsinthedark/shared";
import { Check, Heart, PawPrint, Skull, Sparkles, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { tally } from "./model";
import { ROLE_ICONS } from "./roleIcons";
import type { ActionController } from "./useActionController";

/** Seat colour: stable per seat, spread around the wheel. */
export const seatColor = (seat: number) => `hsl(${(seat * 47 + 200) % 360} 42% 34%)`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * The table: one circle per player. When the server lets you pick, the valid targets
 * breathe and a tap chooses; votes land on the circles as dots. Dead players turn grey,
 * and hovering (or tapping) them reveals their card if it is known.
 */
export function PlayersTable({
  view,
  controller,
}: {
  view: PlayerView;
  controller: ActionController;
}) {
  const votes = view.wolfVotes ?? view.votes;
  const groups = tally(votes);
  const votersOf = (id: PlayerId) => groups.find((group) => group.target === id)?.voters ?? [];
  const seatOf = (id: PlayerId) => view.players.find((player) => player.id === id)?.seat ?? 0;

  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-5 sm:gap-x-6">
      {view.players.map((player, index) => (
        <motion.li
          key={player.id}
          initial={{ opacity: 0, y: 14, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 22 }}
        >
          <Avatar
            player={player}
            isYou={player.id === view.you.id}
            voters={votersOf(player.id).map(seatOf)}
            pickable={controller.canPick(player.id)}
            picked={controller.isPicked(player.id)}
            onPick={() => controller.pick(player.id)}
          />
        </motion.li>
      ))}
    </ul>
  );
}

function Avatar({
  player,
  isYou,
  voters,
  pickable,
  picked,
  onPick,
}: {
  player: PublicPlayer;
  isYou: boolean;
  /** Seats of the players voting for this one. */
  voters: number[];
  pickable: boolean;
  picked: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const [peek, setPeek] = useState(false);
  const RoleIcon = player.role ? ROLE_ICONS[player.role] : null;
  const showTip = peek && !player.alive;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only reveals a tooltip also reachable by focus
    <div
      className="relative flex w-[4.25rem] flex-col items-center gap-1.5 sm:w-20"
      onMouseEnter={() => setPeek(true)}
      onMouseLeave={() => setPeek(false)}
    >
      <motion.button
        type="button"
        onClick={pickable ? onPick : () => setPeek(!peek)}
        onFocus={() => setPeek(true)}
        onBlur={() => setPeek(false)}
        aria-pressed={pickable ? picked : undefined}
        aria-label={avatarLabel(t, player, isYou)}
        whileTap={pickable ? { scale: 0.9 } : {}}
        animate={
          pickable && !picked
            ? { scale: [1, 1.06, 1], filter: "grayscale(0)" }
            : { scale: 1, filter: player.alive ? "grayscale(0)" : "grayscale(1)" }
        }
        transition={
          pickable && !picked
            ? { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
            : { duration: 0.6 }
        }
        className={`relative flex size-14 items-center justify-center rounded-full font-semibold text-lg sm:size-16 text-white shadow-lg ring-offset-2 ring-offset-transparent transition-[box-shadow] ${
          picked
            ? "ring-4 ring-[var(--accent)]"
            : pickable
              ? "ring-2 ring-[var(--accent)]/60"
              : player.isWolfAlly
                ? "ring-2 ring-blood"
                : "ring-1 ring-white/20"
        } ${player.alive ? "" : "opacity-55"} ${pickable ? "cursor-pointer" : "cursor-default"}`}
        style={{
          background: `radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.25), transparent 55%), ${seatColor(player.seat)}`,
          boxShadow: picked ? "0 0 24px -2px var(--accent)" : undefined,
        }}
      >
        {initials(player.name)}

        <AnimatePresence>
          {!player.alive && (
            <motion.span
              key="skull"
              initial={{ y: -30, opacity: 0, rotate: -25 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45"
            >
              <Skull aria-hidden="true" className="size-7 text-white/90" />
            </motion.span>
          )}
          {picked && (
            <motion.span
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="absolute -bottom-1 -left-1 flex size-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
            >
              <Check aria-hidden="true" className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>

        <span className="absolute -top-1 -left-1 flex gap-0.5">
          {player.isSheriff && <Badge icon={<Star className="size-3.5 text-amber-300" />} />}
          {player.isWolfAlly && <Badge icon={<PawPrint className="size-3.5 text-blood" />} />}
          {player.isLover && <Badge icon={<Heart className="size-3.5 text-pink-300" />} />}
          {player.charmed && <Badge icon={<Sparkles className="size-3.5 text-violet-300" />} />}
        </span>

        <AnimatePresence>
          {voters.length > 0 && (
            <motion.span
              key={voters.length}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 18 }}
              className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[var(--on-accent)] text-xs"
            >
              {voters.length}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <span
        className={`max-w-full truncate text-sm ${player.alive ? "" : "text-ink-muted line-through"}`}
      >
        {player.name}
      </span>
      {isYou && <span className="-mt-1.5 text-[var(--accent)] text-xs">{t("game.youShort")}</span>}

      {/* Who voted for this player: one dot per voter, in their seat colour. */}
      <span className="flex min-h-2 flex-wrap justify-center gap-0.5">
        <AnimatePresence>
          {voters.map((seat) => (
            <motion.span
              key={seat}
              layout
              initial={{ scale: 0, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0 }}
              className="size-2 rounded-full ring-1 ring-black/40"
              style={{ background: seatColor(seat) }}
            />
          ))}
        </AnimatePresence>
      </span>

      <AnimatePresence>
        {showTip && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass-strong absolute top-full z-20 mt-1 flex w-44 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm"
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

function Badge({ icon }: { icon: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 items-center justify-center rounded-full bg-black/60"
    >
      {icon}
    </span>
  );
}

function avatarLabel(
  t: ReturnType<typeof useTranslation>["t"],
  player: PublicPlayer,
  isYou: boolean,
): string {
  const parts = [player.name];
  if (isYou) parts.push(`(${t("game.youShort")})`);
  if (!player.alive)
    parts.push(
      player.role ? t("game.dead", { role: t(`roles.${player.role}`) }) : t("game.players.dead"),
    );
  if (player.isSheriff) parts.push(t("game.players.sheriff"));
  if (player.isWolfAlly) parts.push(t("game.players.wolfAlly"));
  if (player.isLover) parts.push(t("game.players.lover"));
  if (player.charmed) parts.push(t("game.players.charmed"));
  return parts.join(", ");
}
