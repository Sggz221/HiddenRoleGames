import type { NarrationLine } from "@howlsinthedark/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { narrationText } from "./narration";

/** What the narrator has said this game, newest at the bottom (scrolled into view). */
export function NarratorFeed({ lines }: { lines: NarrationLine[] }) {
  const { t } = useTranslation();
  const list = useRef<HTMLOListElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever a line arrives
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, [lines.length]);

  if (lines.length === 0) return null;
  return (
    <section aria-labelledby="narrator-title" className="flex flex-col gap-2">
      <h2 id="narrator-title" className="font-display font-semibold text-xl">
        {t("game.narrator")}
      </h2>
      <ol ref={list} className="flex max-h-64 flex-col gap-1.5 overflow-y-auto" aria-live="polite">
        {lines.map((line, index) => (
          // Lines are append-only, so the index is a stable key.
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
          <li key={index} className="rounded-lg bg-panel px-3 py-2 text-sm">
            {narrationText(t, line)}
          </li>
        ))}
      </ol>
    </section>
  );
}
