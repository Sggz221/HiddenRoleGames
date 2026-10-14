import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { HomePage } from "../features/lobby/HomePage";
import { LobbyPage } from "../features/lobby/LobbyPage";
import { session } from "../net/client";
import { useSession } from "../net/useSession";

// The game screen brings Motion: loaded only when a game starts, not on the home.
const GamePage = lazy(() =>
  import("../features/game/GamePage").then((module) => ({ default: module.GamePage })),
);

export function App() {
  const { t } = useTranslation();
  const { resuming, room, playerId, game, narration, connection, clockOffset, chat } = useSession();

  if (resuming && !room) return <Status text={t("home.resuming")} />;
  if (!room || !playerId) return <HomePage />;
  // A finished game stays on screen until the player goes back to the room.
  if (game && (room.gameId || game.view.result)) {
    return (
      <Suspense fallback={<Status text={t("home.working")} />}>
        <GamePage
          gameId={room.gameId ?? "finished"}
          game={game}
          chat={chat}
          onChat={(channel, text) => session.sendChat(channel, text)}
          narration={narration}
          clockOffset={clockOffset}
          onAction={(action) => session.sendAction(action)}
          onDismissResult={() => session.dismissResult()}
        />
      </Suspense>
    );
  }
  if (room.gameId) return <Status text={t("home.working")} />;
  return <LobbyPage room={room} playerId={playerId} connection={connection} />;
}

function Status({ text }: { text: string }) {
  return (
    <p role="status" className="flex min-h-dvh items-center justify-center text-ink-muted">
      {text}
    </p>
  );
}
