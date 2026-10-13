import { APP_NAME, MIN_PLAYERS, type RoomStateMessage } from "@howlsinthedark/shared";
import type { TFunction } from "i18next";
import { Check, Copy, Crown, LogOut, Share2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioToggle } from "../../components/AudioToggle";
import { session } from "../../net/client";
import type { Connection } from "../../net/session";
import { readStored, writeStored } from "../../net/storage";
import { ROOM_QUERY_PARAM } from "./EntryPanel";
import { HostSettings } from "./HostSettings";
import {
  type LobbySettings,
  parseSettings,
  type StartProblem,
  startProblems,
  toRoomStart,
} from "./settings";

const SETTINGS_KEY = "howlsinthedark.lobbySettings";

interface Props {
  room: RoomStateMessage;
  playerId: string;
  connection: Connection;
}

/** Waiting room: share the code, see who is in and, for the host, tune and start the game. */
export function LobbyPage({ room, playerId, connection }: Props) {
  const { t } = useTranslation();
  const isHost = room.hostId === playerId;
  const players = room.players.length;
  const host = room.players.find((player) => player.id === room.hostId);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      {connection === "offline" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-blood/20 px-4 py-2 text-sm"
        >
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          {t("lobby.offlineBanner")}
        </p>
      )}

      <header className="flex items-start justify-between gap-4">
        <RoomCode code={room.code} />
        <button
          type="button"
          onClick={() => void session.leaveRoom()}
          className="flex items-center gap-2 rounded-lg border border-panel-border px-3 py-2 text-ink-muted text-sm transition-colors hover:text-ink"
        >
          <LogOut aria-hidden="true" className="size-4" />
          {t("lobby.leave")}
        </button>
      </header>

      <section aria-labelledby="players-title" className="flex flex-col gap-3">
        <h2 id="players-title" className="font-display font-semibold text-xl">
          {t("lobby.players", { count: players, max: room.maxPlayers })}
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {room.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-2 rounded-xl border border-panel-border bg-panel px-3 py-2"
            >
              {player.id === room.hostId && (
                <Crown aria-label={t("lobby.host")} className="size-4 shrink-0 text-moon" />
              )}
              <span className={`truncate ${player.connected ? "" : "text-ink-muted"}`}>
                {player.name}
              </span>
              {player.id === playerId && (
                <span className="text-ink-muted text-xs">({t("lobby.you")})</span>
              )}
              {!player.connected && (
                <WifiOff
                  aria-label={t("lobby.offline")}
                  className="ml-auto size-4 text-ink-muted"
                />
              )}
            </li>
          ))}
        </ul>
        {players < MIN_PLAYERS && (
          <p className="text-ink-muted text-sm">
            {t("lobby.needMore", { count: MIN_PLAYERS - players, min: MIN_PLAYERS })}
          </p>
        )}
      </section>

      {isHost ? (
        <HostControls players={players} />
      ) : (
        <p className="rounded-xl border border-panel-border bg-panel p-4 text-center text-ink-muted">
          {t("lobby.waitingHost", { name: host?.name ?? "" })}
        </p>
      )}

      <footer className="mt-auto flex justify-center pt-4">
        <AudioToggle />
      </footer>
    </div>
  );
}

function HostControls({ players }: { players: number }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(() => parseSettings(readStored(SETTINGS_KEY), players));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = startProblems(settings, players);
  // "Not enough players" is already announced under the player list.
  const shown = problems.filter((problem) => problem.kind !== "notEnoughPlayers");

  const change = (next: LobbySettings) => {
    setSettings(next);
    writeStored(SETTINGS_KEY, JSON.stringify(next));
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    const result = await session.startGame(toRoomStart(settings, players));
    setStarting(false);
    if (!result.ok) setError(t(`errors.${result.code}`));
  };

  return (
    <>
      <HostSettings settings={settings} players={players} onChange={change} />
      <div className="flex flex-col gap-2">
        {shown.length > 0 && (
          <ul className="flex flex-col gap-1 text-amber-200 text-sm" aria-live="polite">
            {shown.map((problem) => (
              <li key={JSON.stringify(problem)}>{problemText(t, problem)}</li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-rose-300 text-sm">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={starting || problems.length > 0}
          onClick={() => void start()}
          className="w-full rounded-xl bg-blood px-6 py-4 font-semibold text-lg text-white shadow-blood/30 shadow-lg transition-colors enabled:hover:bg-blood-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? t("lobby.starting") : t("lobby.start")}
        </button>
      </div>
    </>
  );
}

function problemText(t: TFunction, problem: StartProblem): string {
  switch (problem.kind) {
    case "notEnoughPlayers":
      return t("lobby.problems.notEnoughPlayers", { min: problem.min, players: problem.players });
    case "deckSize":
      return t("lobby.problems.deckSize", { cards: problem.cards, players: problem.players });
    case "tooManyCopies":
      return t("lobby.problems.tooManyCopies", {
        max: problem.max,
        role: t(`roles.${problem.role}`),
      });
    case "exactCopies":
      return t("lobby.problems.exactCopies", {
        required: problem.required,
        role: t(`roles.${problem.role}`),
      });
    case "noWolves":
      return t("lobby.problems.noWolves");
    case "wolvesMajority":
      return t("lobby.problems.wolvesMajority", { wolves: problem.wolves, others: problem.others });
  }
}

/** The code, big and spaced out, with copy-link and native share. */
function RoomCode({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?${ROOM_QUERY_PARAM}=${code}`;
  const canShare = typeof navigator.share === "function";

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked: the code is on screen anyway.
    }
  };

  const share = () =>
    navigator
      .share({ title: APP_NAME, text: t("lobby.shareText", { app: APP_NAME, code }), url: link })
      .catch(() => {});

  const action =
    "flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-sm transition-colors hover:border-moon";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink-muted text-xs uppercase tracking-widest">{t("lobby.codeLabel")}</p>
      <p className="font-bold font-mono text-4xl text-moon tracking-[0.3em]">{code}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => void copy()} className={action}>
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          <span aria-live="polite">{copied ? t("lobby.copied") : t("lobby.copy")}</span>
        </button>
        {canShare && (
          <button type="button" onClick={() => void share()} className={action}>
            <Share2 aria-hidden="true" className="size-4" />
            {t("lobby.share")}
          </button>
        )}
      </div>
    </div>
  );
}
