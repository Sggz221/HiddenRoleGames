import type {
  ChatChannel,
  ChatMessage,
  GameAction,
  GameViewMessage,
  NarrationLine,
  PlayerView,
} from "@howlsinthedark/shared";
import { AnimatePresence, LayoutGroup, MotionConfig } from "motion/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { DeathOverlay } from "../../animations/DeathOverlay";
import { Landscape } from "../../animations/Landscape";
import { audioManager } from "../../audio/audioManager";
import { scenes, session } from "../../net/client";
import { phaseKey, type Result } from "../../net/session";
import { readStored, writeStored } from "../../net/storage";
import { ActionDock } from "./ActionDock";
import { ChatDrawer } from "./ChatDrawer";
import { HistoryPanel } from "./HistoryPanel";
import { PlayersTable } from "./PlayersTable";
import { useReduceMotionSetting } from "./preferences";
import { ResultPanel } from "./ResultPanel";
import { RoleReveal } from "./RoleReveal";
import { roleTheme, themeVars } from "./roleTheme";
import { TopBar } from "./TopBar";
import { useActionController } from "./useActionController";
import { useGameClock } from "./useGameClock";

interface Props {
  gameId: string;
  game: GameViewMessage;
  narration: NarrationLine[];
  chat: ChatMessage[];
  clockOffset: number;
  onAction: (action: GameAction) => Promise<Result>;
  onChat: (channel: ChatChannel, text: string) => Promise<Result>;
  onDismissResult: () => void;
}

/** The game, phase by phase. Everything shown comes from the player's own `PlayerView`. */
export function GamePage(props: Props) {
  const reduce = useReduceMotionSetting();
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <LayoutGroup>
        <GameScreen {...props} reduce={reduce} />
      </LayoutGroup>
    </MotionConfig>
  );
}

const revealKey = (gameId: string) => `howlsinthedark.revealed.${gameId}`;

function GameScreen({
  gameId,
  game,
  narration,
  chat,
  clockOffset,
  onAction,
  onChat,
  onDismissResult,
  reduce,
}: Props & { reduce: boolean }) {
  const { view, phaseEndsAt } = game;
  const theme = roleTheme(view.you.role, view.you.side);
  const [revealing, setRevealing] = useState(() => readStored(revealKey(gameId)) !== "1");
  useGameClock(game, clockOffset);
  useGameSounds(view);

  const finishReveal = () => {
    writeStored(revealKey(gameId), "1");
    setRevealing(false);
  };

  return (
    <div
      style={themeVars(theme) as CSSProperties}
      data-reduce-motion={reduce || undefined}
      className="relative min-h-dvh pb-8"
    >
      <Landscape />
      {theme.font === "wolf" && (
        // The pack sees the world through a red haze.
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-[5] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(90_0_12/0.5))]"
        />
      )}

      <TopBar
        view={view}
        phaseEndsAt={phaseEndsAt}
        clockOffset={clockOffset}
        showRole={!revealing}
        onReplayReveal={() => setRevealing(true)}
      />

      <main className="mx-auto mt-6 flex w-full max-w-4xl flex-col gap-5 px-3 sm:mt-10 sm:px-6">
        {view.result ? (
          <ResultPanel view={view} result={view.result} onBack={onDismissResult} />
        ) : (
          <ActionArea key={phaseKey(game)} view={view} onAction={onAction} />
        )}
        <HistoryPanel lines={narration} />
      </main>

      <ChatDrawer view={view} messages={chat} onSend={onChat} />
      <DeathOverlay queue={scenes} view={view} />
      <AnimatePresence>
        {revealing && <RoleReveal you={view.you} onDone={finishReveal} />}
      </AnimatePresence>
    </div>
  );
}

/** The table and the action dock share one controller, reset every phase. */
function ActionArea({
  view,
  onAction,
}: {
  view: PlayerView;
  onAction: (action: GameAction) => Promise<Result>;
}) {
  // The server keeps what you chose: it is part of your view and survives a reload.
  const { choice } = view.you;
  const controller = useActionController(view, choice, onAction);
  return (
    <section className="glass flex flex-col gap-7 rounded-[2rem] px-4 py-6 sm:px-8 sm:py-8">
      <PlayersTable view={view} controller={controller} />
      <ActionDock view={view} choice={choice} controller={controller} />
    </section>
  );
}

/** Music follows the phase; a stinger at the end; a pop for others' chat lines. */
function useGameSounds(view: PlayerView): void {
  const ended = useRef(view.result !== null);

  useEffect(() => audioManager.setPhase(view.phase), [view.phase]);

  useEffect(() => {
    if (!view.result || ended.current) return;
    ended.current = true;
    const won = view.result.winners.includes(view.you.id);
    audioManager.playEffect(won ? "stinger-win" : "stinger-lose");
  }, [view.result, view.you.id]);

  useEffect(
    () =>
      session.onChat((message) => {
        if (message.from !== view.you.id) audioManager.playEffect("chat-pop");
      }),
    [view.you.id],
  );

  useEffect(
    () => () => {
      audioManager.stop();
      scenes.clear();
    },
    [],
  );
}
