import type { NarrationLine } from "@howlsinthedark/shared";
import { ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { narrationText } from "./narration";

/** Colour of a line by what it tells: deaths in red, secrets in your accent, the end in gold. */
function tone(line: NarrationLine): string {
  if (line.key.startsWith("death.")) return "text-rose-200";
  if (line.key.startsWith("private.") || line.key === "game.yourRole")
    return "text-[var(--accent)]";
  if (line.key.startsWith("end.")) return "text-amber-200 font-semibold";
  return "text-ink/90";
}

const COLLAPSED = 2;

/** The narrator's log at the bottom: the latest lines, expandable to the whole game. */
export function HistoryPanel({ lines }: { lines: NarrationLine[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const shown = open ? lines : lines.slice(-COLLAPSED);
  const offset = lines.length - shown.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the newest line
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [lines.length, open]);

  if (!lines.length) return null;
  return (
    <motion.section
      layout
      aria-labelledby="history-title"
      className="glass w-full rounded-3xl px-4 py-3"
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="history-title"
          className="font-display text-ink-muted text-sm uppercase tracking-widest"
        >
          {t("game.history")}
        </h2>
        {lines.length > COLLAPSED && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-ink-muted text-xs hover:text-ink"
          >
            {open ? t("game.showLess") : t("game.showMore")}
            <motion.span animate={{ rotate: open ? 180 : 0 }}>
              <ChevronUp aria-hidden="true" className="size-4" />
            </motion.span>
          </button>
        )}
      </div>
      <motion.ol
        ref={list}
        layout
        aria-live="polite"
        className={`mt-2 flex flex-col gap-1 overflow-y-auto ${open ? "max-h-72" : ""}`}
      >
        <AnimatePresence initial={false}>
          {shown.map((line, index) => (
            <motion.li
              // Lines are append-only, so the absolute position is a stable key.
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
              key={offset + index}
              layout
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className={`text-sm leading-snug ${tone(line)}`}
            >
              {narrationText(t, line)}
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ol>
    </motion.section>
  );
}
