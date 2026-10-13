import type { GameViewMessage, NarrationLine } from "@howlsinthedark/shared";
import { useTranslation } from "react-i18next";
import { narrationText } from "./narration";

interface Props {
  game: GameViewMessage | null;
  narration: NarrationLine[];
}

/**
 * Minimal in-game screen: your card and what the narrator says. The full screen with phases,
 * actions and voting is HID-10.
 */
export function GamePage({ game, narration }: Props) {
  const { t } = useTranslation();
  const role = game?.view.you.role;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <h1 className="font-display font-semibold text-3xl">{t("game.started")}</h1>
      {role && (
        <section className="rounded-2xl border border-moon/40 bg-panel p-5">
          <p className="text-ink-muted text-xs uppercase tracking-widest">{t("game.yourCard")}</p>
          <p className="font-display text-4xl text-moon">{t(`roles.${role}`)}</p>
        </section>
      )}
      <section aria-labelledby="narrator-title" className="flex flex-col gap-2">
        <h2 id="narrator-title" className="font-display font-semibold text-xl">
          {t("game.narrator")}
        </h2>
        <ol className="flex flex-col gap-2" aria-live="polite">
          {narration.map((line, index) => (
            // Lines are append-only, so the index is a stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            <li key={index} className="rounded-lg bg-panel px-3 py-2">
              {narrationText(t, line)}
            </li>
          ))}
        </ol>
      </section>
      <p className="mt-auto text-center text-ink-muted text-sm">{t("game.comingSoon")}</p>
    </div>
  );
}
