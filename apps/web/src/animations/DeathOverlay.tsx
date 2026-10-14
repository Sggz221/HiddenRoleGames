import type { PlayerView } from "@howlsinthedark/shared";
import { Gavel, Skull, Star, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { SceneQueue } from "./queue";
import type { Scene } from "./scenes";

/** Seconds a scene stays before moving on by itself (a tap skips it). */
const sceneSeconds = (scene: Scene) => 3 + scene.deaths.length * 1.5;

type T = ReturnType<typeof useTranslation>["t"];

function sceneTitle(t: T, scene: Scene): string {
  switch (scene.kind) {
    case "dawn":
      return t("game.overlay.dawn");
    case "vote":
      return t("game.overlay.vote");
    case "sheriff":
      return t("game.overlay.sheriff");
    case "deaths":
      return t("game.overlay.deaths");
  }
}

/** The line under the title when nobody died (or what the vote decided instead). */
function sceneMessage(t: T, scene: Scene, names: (ids: string[]) => string): string | null {
  switch (scene.kind) {
    case "dawn":
      return scene.deaths.length ? null : t("game.overlay.nobody");
    case "vote":
      if (scene.outcome === "tie") return t("game.overlay.voteTie", { names: names(scene.tied) });
      if (scene.outcome === "runoff")
        return t("game.overlay.voteRunoff", { names: names(scene.tied) });
      return scene.deaths.length ? null : t("game.overlay.voteNobody");
    case "sheriff":
      return scene.player
        ? t("game.overlay.sheriffElected", { name: names([scene.player]) })
        : t("game.overlay.sheriffNone");
    case "deaths":
      return null;
  }
}

const SCENE_ICONS = { dawn: Sun, vote: Gavel, sheriff: Star, deaths: null } as const;

/**
 * Announces dawns and deaths full screen, one by one. Tapping anywhere skips. The board
 * underneath is already up to date: this only retells what happened.
 */
export function DeathOverlay({ queue, view }: { queue: SceneQueue; view: PlayerView }) {
  const { t } = useTranslation();
  const scene = useSyncExternalStore(queue.subscribe, queue.current);
  const reduce = useReducedMotion();
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? id;
  const names = (ids: string[]) =>
    new Intl.ListFormat("es", { style: "long", type: "conjunction" }).format(ids.map(name));

  useEffect(() => {
    if (!scene) return;
    const id = setTimeout(() => queue.next(), sceneSeconds(scene) * 1000);
    return () => clearTimeout(id);
  }, [scene, queue]);

  // A short fade even with reduced motion: no movement, just appearing.
  const fade = { duration: reduce ? 0.15 : 0.4 };

  return (
    <AnimatePresence>
      {scene && (
        // Tapping anywhere skips (a convenience); the button is the accessible way.
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-title"
          key={JSON.stringify(scene)}
          onClick={() => queue.next()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          className="glass-strong fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 rounded-none border-0 px-6 text-center"
        >
          <h2 id="overlay-title" className="flex items-center gap-3 font-display text-3xl">
            <SceneIcon scene={scene} />
            {sceneTitle(t, scene)}
          </h2>
          {sceneMessage(t, scene, names) && (
            <p className="max-w-md text-lg text-ink/85">{sceneMessage(t, scene, names)}</p>
          )}
          {scene.deaths.length > 0 && (
            <ul className="flex w-full max-w-sm flex-col gap-3" aria-live="polite">
              {scene.deaths.map((death, index) => (
                <motion.li
                  key={death.player}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: -40 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ ...fade, delay: reduce ? 0 : 0.5 + index * 1.2 }}
                  className="glass flex items-center gap-4 rounded-2xl border-blood/60 px-4 py-3 text-left shadow-[0_0_30px_-10px_rgb(194_65_75/0.8)]"
                >
                  <Skull aria-hidden="true" className="size-7 shrink-0 text-blood" />
                  <div>
                    <p className="font-display text-2xl">{name(death.player)}</p>
                    <p className="text-ink-muted text-sm">
                      {t(`game.overlay.cause.${death.cause}`)} ·{" "}
                      {death.role
                        ? t(`roles.${death.role}`)
                        : death.side
                          ? t("game.overlay.side", { side: t(`sides.${death.side}`) })
                          : t("game.overlay.hidden")}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
          <button
            type="button"
            // biome-ignore lint/a11y/noAutofocus: the dialog's only control; keyboard users can skip at once
            autoFocus
            onClick={(event) => {
              event.stopPropagation();
              queue.next();
            }}
            className="rounded-lg border border-panel-border px-4 py-2 text-ink-muted text-sm hover:text-ink"
          >
            {t("game.overlay.skip")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SceneIcon({ scene }: { scene: Scene }) {
  const Icon = SCENE_ICONS[scene.kind];
  return Icon ? <Icon aria-hidden="true" className="size-8 text-amber-200" /> : null;
}
