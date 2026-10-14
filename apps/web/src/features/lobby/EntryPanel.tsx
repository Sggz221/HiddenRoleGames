import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_NAME_MAX_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "@howlsinthedark/shared";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { session } from "../../net/client";
import type { Result } from "../../net/session";
import { readStored, writeStored } from "../../net/storage";

const NAME_KEY = "howlsinthedark.name";
/** Shared links look like `/?sala=ABCDEF`. */
export const ROOM_QUERY_PARAM = "sala";

const normalizeRoomCode = (value: string) =>
  value
    .toUpperCase()
    .split("")
    .filter((char) => ROOM_CODE_ALPHABET.includes(char))
    .join("")
    .slice(0, ROOM_CODE_LENGTH);

function codeFromUrl(): string {
  return normalizeRoomCode(new URLSearchParams(location.search).get(ROOM_QUERY_PARAM) ?? "");
}

/** Name, "create a room" and "join with a code": the way into the lobby. */
export function EntryPanel() {
  const { t } = useTranslation();
  const nameId = useId();
  const codeId = useId();
  const errorId = useId();
  const [name, setName] = useState(() => readStored(NAME_KEY) ?? "");
  const [code, setCode] = useState(codeFromUrl);
  // Arrived through a shared link or a scanned QR: only the name is missing.
  const [invitedTo] = useState(codeFromUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: (name: string) => Promise<Result>) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("home.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    writeStored(NAME_KEY, trimmed);
    const result = await action(trimmed);
    setBusy(false);
    if (!result.ok) setError(t(`errors.${result.code}`));
    else history.replaceState(null, "", location.pathname);
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    void run((player) => session.joinRoom(code, player));
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-panel-border bg-sky/80 p-5 text-left shadow-2xl shadow-black/50 backdrop-blur-md">
      {invitedTo.length === ROOM_CODE_LENGTH && (
        <p className="rounded-lg border border-moon/30 bg-moon/10 px-4 py-2 text-center text-sm">
          {t("home.invited", { code: invitedTo })}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="font-medium text-ink-muted text-sm">
          {t("home.nameLabel")}
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={PLAYER_NAME_MAX_LENGTH}
          placeholder={t("home.namePlaceholder")}
          autoComplete="nickname"
          // biome-ignore lint/a11y/noAutofocus: invited players land here only to type their name
          autoFocus={invitedTo.length === ROOM_CODE_LENGTH}
          aria-describedby={error ? errorId : undefined}
          className="rounded-lg border border-panel-border bg-sky-deep px-4 py-3 text-lg placeholder:text-ink-muted/60 focus:border-moon focus:outline-none"
        />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void run((player) => session.createRoom(player))}
        className="w-full rounded-xl bg-blood px-6 py-4 font-semibold text-lg text-white shadow-blood/30 shadow-lg transition-colors enabled:hover:bg-blood-strong disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? t("home.working") : t("home.createRoom")}
      </button>

      <form className="flex flex-col gap-2" onSubmit={join}>
        <label htmlFor={codeId} className="font-medium text-ink-muted text-sm">
          {t("home.joinTitle")}
        </label>
        <div className="flex gap-2">
          <input
            id={codeId}
            value={code}
            onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
            placeholder={t("home.joinPlaceholder")}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-panel-border bg-sky-deep px-4 py-3 font-mono text-lg uppercase tracking-[0.3em] placeholder:text-ink-muted/60 placeholder:tracking-normal focus:border-moon focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length !== ROOM_CODE_LENGTH}
            className="rounded-lg border border-panel-border px-5 py-3 font-semibold transition-colors enabled:hover:border-moon disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("home.join")}
          </button>
        </div>
      </form>

      {error && (
        <p id={errorId} role="alert" className="text-center text-rose-300 text-sm">
          {error}
        </p>
      )}
      <p className="text-center text-ink-muted text-sm">
        {t("home.players", { min: MIN_PLAYERS, max: MAX_PLAYERS })}
      </p>
    </div>
  );
}
