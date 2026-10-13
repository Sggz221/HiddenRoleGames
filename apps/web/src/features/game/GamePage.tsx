import type {
  GameAction,
  GameViewMessage,
  NarrationLine,
  PlayerView,
} from "@howlsinthedark/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { audioManager } from "../../audio/audioManager";
import { AudioToggle } from "../../components/AudioToggle";
import { phaseKey, type Result } from "../../net/session";
import { ActionPanel } from "./ActionPanel";
import { NarratorFeed } from "./NarratorFeed";
import { PhaseBar } from "./PhaseBar";
import { PlayerList } from "./PlayerList";
import { ResultPanel } from "./ResultPanel";
import { YourCard } from "./YourCard";

interface Props {
  game: GameViewMessage;
  narration: NarrationLine[];
  choice: GameAction | null;
  clockOffset: number;
  onAction: (action: GameAction) => Promise<Result>;
  onDismissResult: () => void;
}

/** The game, phase by phase. Everything shown comes from the player's own `PlayerView`. */
export function GamePage({
  game,
  narration,
  choice,
  clockOffset,
  onAction,
  onDismissResult,
}: Props) {
  const { view, phaseEndsAt } = game;

  // Background music follows the phase; it stops when leaving the game.
  useEffect(() => audioManager.setPhase(view.phase), [view.phase]);
  useEffect(() => () => audioManager.stop(), []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 pb-8">
      <PhaseBar
        phase={view.phase}
        day={view.day}
        phaseEndsAt={phaseEndsAt}
        clockOffset={clockOffset}
      />
      {view.result ? (
        <ResultPanel view={view} result={view.result} onBack={onDismissResult} />
      ) : (
        <>
          {view.pending ? (
            <ActionPanel key={phaseKey(game)} view={view} choice={choice} onSend={onAction} />
          ) : (
            <IdleMessage view={view} />
          )}
          <YourCard view={view} />
        </>
      )}
      <NarratorFeed lines={narration} />
      {!view.result && <PlayerList view={view} />}
      <footer className="mt-auto flex justify-center pt-2">
        <AudioToggle />
      </footer>
    </div>
  );
}

/** What to show when there is nothing to do right now. */
function IdleMessage({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const { phase } = view;
  let text: string;
  if (!view.you.alive) text = t("game.idle.dead");
  else if (phase.kind === "night") text = t("game.idle.night");
  else if (phase.kind === "reaction") {
    const actor = view.players.find((player) => player.id === phase.decision.actor);
    text = t("game.idle.waitingFor", { name: actor?.name ?? "" });
  } else if (phase.kind === "day" && phase.step === "debate") text = t("game.idle.debate");
  else text = t("game.idle.waitingVotes");

  return (
    <p
      className="rounded-2xl border border-panel-border bg-panel p-5 text-center text-ink-muted"
      aria-live="polite"
    >
      {text}
    </p>
  );
}
