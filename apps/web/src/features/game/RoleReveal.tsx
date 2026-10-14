import type { SelfView } from "@howlsinthedark/shared";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { audioManager } from "../../audio/audioManager";
import { ROLE_ICONS } from "./roleIcons";
import { roleTheme } from "./roleTheme";

/**
 * The opening moment: your card arrives face down, flips when you tap it and, once read,
 * flies into the chip of the top bar (shared `layoutId`). Shown once per game, or again
 * from the settings.
 */
export function RoleReveal({ you, onDone }: { you: SelfView; onDone: () => void }) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const theme = roleTheme(you.role, you.side);
  const Icon = ROLE_ICONS[you.role];
  const wolf = theme.font === "wolf";

  const flip = () => {
    if (flipped) return;
    audioManager.playEffect("card-flip");
    setFlipped(true);
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.2 } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/70 px-6 backdrop-blur-md"
    >
      <h2 id="reveal-title" className="font-display text-ink/80 text-xl uppercase tracking-[0.3em]">
        {t("game.reveal.title")}
      </h2>

      <motion.div layoutId="role-card" className="[perspective:1200px]">
        <motion.button
          type="button"
          onClick={flip}
          aria-label={flipped ? t(`roles.${you.role}`) : t("game.reveal.tap")}
          initial={{ y: 80, rotate: -6, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1, rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 18 }}
          className="relative block h-96 w-64 [transform-style:preserve-3d]"
        >
          {/* Back of the card. */}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border border-moon/40 bg-[repeating-linear-gradient(45deg,rgb(244_233_200/0.07)_0_12px,transparent_12px_24px)] bg-sky-deep shadow-2xl [backface-visibility:hidden]">
            <span className="font-display text-5xl text-moon/80">?</span>
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="text-ink-muted text-sm"
            >
              {t("game.reveal.tap")}
            </motion.span>
          </span>
          {/* Face: your role (only rendered once flipped, so it is never in the page before). */}
          <span
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 p-6 text-center shadow-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{
              borderColor: theme.accent,
              background: wolf
                ? "radial-gradient(circle at 50% 30%, #3a0a10, #0a0204 75%)"
                : `radial-gradient(circle at 50% 30%, color-mix(in oklab, ${theme.accent} 22%, #0b1020), #05070f 75%)`,
              boxShadow: `0 0 60px -10px ${theme.accent}`,
            }}
          >
            {flipped && (
              <>
                <Icon aria-hidden="true" className="size-16" style={{ color: theme.accent }} />
                <span
                  className={`text-4xl leading-tight ${wolf ? "font-wolf" : "font-display"}`}
                  style={{ color: theme.accent }}
                >
                  {t(`roles.${you.role}`)}
                </span>
                <span className="text-ink/85 text-sm">{t(`roleGoals.${you.role}`)}</span>
              </>
            )}
          </span>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.6 } }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <p className="text-ink-muted text-sm">{t("game.reveal.secret")}</p>
            <button
              type="button"
              // biome-ignore lint/a11y/noAutofocus: the dialog's next step once the card is read
              autoFocus
              onClick={onDone}
              className="rounded-full px-8 py-3 font-semibold"
              style={{ background: theme.accent, color: theme.onAccent }}
            >
              {t("game.reveal.ok")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
