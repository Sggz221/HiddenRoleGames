import { useTranslation } from "react-i18next";
import { GamePage } from "../features/game/GamePage";
import { HomePage } from "../features/lobby/HomePage";
import { LobbyPage } from "../features/lobby/LobbyPage";
import { useSession } from "../net/useSession";

export function App() {
  const { t } = useTranslation();
  const { resuming, room, playerId, game, narration, connection } = useSession();

  if (resuming && !room) {
    return (
      <p role="status" className="flex min-h-dvh items-center justify-center text-ink-muted">
        {t("home.resuming")}
      </p>
    );
  }
  if (!room || !playerId) return <HomePage />;
  if (room.gameId) return <GamePage game={game} narration={narration} />;
  return <LobbyPage room={room} playerId={playerId} connection={connection} />;
}
