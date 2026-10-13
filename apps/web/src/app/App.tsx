import { useTranslation } from "react-i18next";
import { GamePage } from "../features/game/GamePage";
import { HomePage } from "../features/lobby/HomePage";
import { LobbyPage } from "../features/lobby/LobbyPage";
import { session } from "../net/client";
import { useSession } from "../net/useSession";

export function App() {
  const { t } = useTranslation();
  const { resuming, room, playerId, game, narration, connection, choice, clockOffset } =
    useSession();

  if (resuming && !room) {
    return (
      <p role="status" className="flex min-h-dvh items-center justify-center text-ink-muted">
        {t("home.resuming")}
      </p>
    );
  }
  if (!room || !playerId) return <HomePage />;
  // A finished game stays on screen until the player goes back to the room.
  if (game && (room.gameId || game.view.result)) {
    return (
      <GamePage
        game={game}
        narration={narration}
        choice={choice}
        clockOffset={clockOffset}
        onAction={(action) => session.sendAction(action)}
        onDismissResult={() => session.dismissResult()}
      />
    );
  }
  if (room.gameId) {
    return (
      <p role="status" className="flex min-h-dvh items-center justify-center text-ink-muted">
        {t("home.working")}
      </p>
    );
  }
  return <LobbyPage room={room} playerId={playerId} connection={connection} />;
}
