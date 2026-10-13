import { gsap } from "gsap";
import { useEffect, useLayoutEffect, useRef } from "react";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Sun and moon behind the game. At dawn the moon sets and the sun rises (GSAP timeline);
 * at dusk the reverse. With reduced motion they simply swap.
 */
export function Sky({ day }: { day: boolean }) {
  const sun = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const up = { y: 0, opacity: 1 };
    const down = { y: 240, opacity: 0 };
    const [rising, setting] = day ? [sun.current, moon.current] : [moon.current, sun.current];
    if (!rising || !setting) return;

    // The first render (or a resumed game) starts in place, without a sunrise.
    if (first.current || prefersReducedMotion()) {
      first.current = false;
      gsap.set(rising, up);
      gsap.set(setting, down);
      return;
    }
    const timeline = gsap
      .timeline({ defaults: { ease: "power2.inOut" } })
      .to(setting, { ...down, duration: 1.2 })
      .fromTo(rising, down, { ...up, duration: 1.6 }, "-=0.5");
    return () => {
      timeline.kill();
    };
  }, [day]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        ref={moon}
        className="absolute top-16 right-[8%] size-20 rounded-full bg-moon opacity-0 shadow-[0_0_60px_12px_rgb(244_233_200/0.2)] sm:size-28"
      />
      <div
        ref={sun}
        className="absolute top-14 right-[10%] size-24 rounded-full bg-amber-200 opacity-0 shadow-[0_0_80px_24px_rgb(253_230_138/0.35)] sm:size-32"
      />
    </div>
  );
}

/** Puts the page in day or night colours while mounted; back to night when unmounted. */
export function useTheme(day: boolean): void {
  useEffect(() => {
    document.documentElement.dataset.theme = day ? "day" : "night";
  }, [day]);
  useEffect(
    () => () => {
      document.documentElement.dataset.theme = "night";
    },
    [],
  );
}
