import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { audioManager } from "../audio/audioManager";

interface Props {
  /** Accessible name of the trigger. */
  label: string;
  /** What the trigger shows (an icon, a chip...). */
  trigger: ReactNode;
  children: ReactNode;
  /** Also open while hovering (pointer devices); tapping always toggles. */
  hover?: boolean;
  align?: "start" | "center" | "end";
  triggerClassName?: string;
  panelClassName?: string;
}

const ALIGN = {
  start: "left-0 origin-top-left",
  center: "left-1/2 -translate-x-1/2 origin-top",
  end: "right-0 origin-top-right",
};

/**
 * Animated dropdown: springs out of its trigger, closes on outside tap or Escape. Motion
 * drops the movement under reduced motion (see `MotionConfig` in the game screen).
 */
export function Popover({
  label,
  trigger,
  children,
  hover = false,
  align = "center",
  triggerClassName = "",
  panelClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  const toggle = (next: boolean) => {
    setOpen((current) => {
      if (current !== next) audioManager.playEffect(next ? "ui-open" : "ui-close");
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) toggle(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggle(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
    };
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover is a pointer-only shortcut; the button toggles
    <div
      ref={root}
      className="relative"
      onMouseEnter={hover ? () => toggle(true) : undefined}
      onMouseLeave={hover ? () => toggle(false) : undefined}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => toggle(!open)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className={`glass-strong absolute top-full z-40 mt-2 rounded-2xl p-4 shadow-2xl shadow-black/50 ${ALIGN[align]} ${panelClassName}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
