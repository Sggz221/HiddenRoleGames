import { APP_NAME, MAX_PLAYERS, MIN_PLAYERS } from "@aullidos/shared";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioToggle } from "../../components/AudioToggle";
import { ServerStatusBadge } from "../../components/ServerStatusBadge";

const ROOM_CODE_LENGTH = 6;

const normalizeRoomCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);

export function HomePage() {
  const { t } = useTranslation();
  const codeInputId = useId();
  const [code, setCode] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-between px-6 py-10">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 text-center">
        <div
          aria-hidden="true"
          className="size-28 rounded-full bg-moon motion-safe:animate-moon-glow"
        />

        <header className="space-y-3">
          <h1 className="font-display font-bold text-4xl uppercase tracking-widest sm:text-5xl">
            {APP_NAME}
          </h1>
          <p className="text-balance text-ink-muted">{t("home.tagline")}</p>
        </header>

        <div className="flex w-full flex-col gap-6">
          {/* Room creation and joining are wired up in Hito 2/3. */}
          <button
            type="button"
            disabled
            title={t("home.comingSoon")}
            className="w-full rounded-xl bg-blood px-6 py-4 font-semibold text-lg text-white shadow-lg transition-colors enabled:hover:bg-blood-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("home.createRoom")}
          </button>

          <form
            className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel p-4 text-left"
            onSubmit={(event) => event.preventDefault()}
          >
            <label htmlFor={codeInputId} className="font-medium text-ink-muted text-sm">
              {t("home.joinTitle")}
            </label>
            <div className="flex gap-2">
              <input
                id={codeInputId}
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
                disabled
                title={t("home.comingSoon")}
                className="rounded-lg border border-panel-border px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("home.join")}
              </button>
            </div>
          </form>

          <p className="text-ink-muted text-sm">
            {t("home.players", { min: MIN_PLAYERS, max: MAX_PLAYERS })}
          </p>
        </div>
      </div>

      <footer className="flex flex-col items-center gap-4 pt-8">
        <AudioToggle />
        <ServerStatusBadge />
      </footer>
    </main>
  );
}
