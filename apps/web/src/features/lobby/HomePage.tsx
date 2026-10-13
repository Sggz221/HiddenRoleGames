import { APP_NAME, ROLE_IDS } from "@howlsinthedark/shared";
import {
  Crosshair,
  Eye,
  EyeOff,
  FlaskConical,
  Heart,
  type LucideIcon,
  MessagesSquare,
  PawPrint,
  Shield,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AudioToggle } from "../../components/AudioToggle";
import { Moon, NightScene } from "../../components/NightScene";
import { ServerStatusBadge } from "../../components/ServerStatusBadge";
import { EntryPanel } from "./EntryPanel";

const STEPS = ["step1", "step2", "step3", "step4"] as const;

const ROLES = [
  { id: "werewolf", icon: PawPrint, accent: "text-blood" },
  { id: "seer", icon: Eye, accent: "text-sky-300" },
  { id: "witch", icon: FlaskConical, accent: "text-emerald-300" },
  { id: "hunter", icon: Crosshair, accent: "text-amber-300" },
  { id: "cupid", icon: Heart, accent: "text-pink-300" },
  { id: "little-girl", icon: EyeOff, accent: "text-violet-300" },
] as const satisfies readonly { id: string; icon: LucideIcon; accent: string }[];

const FEATURES = [
  { id: "narrator", icon: Sparkles },
  { id: "mobile", icon: Smartphone },
  { id: "chat", icon: MessagesSquare },
  { id: "fair", icon: Shield },
] as const satisfies readonly { id: string; icon: LucideIcon }[];

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative isolate flex min-h-[78dvh] flex-col items-center overflow-hidden px-6 pt-36 pb-48 text-center sm:pt-24">
        <NightScene />
        <Moon className="top-8 right-6 size-20 sm:top-12 sm:right-[10%] sm:size-32 lg:size-40" />
        <div className="relative z-10 flex max-w-xl flex-col items-center gap-4">
          <p className="text-ink-muted text-xs uppercase tracking-[0.3em]">{t("home.kicker")}</p>
          <h1 className="font-display font-bold text-5xl leading-none tracking-wide drop-shadow-[0_0_24px_rgb(244_233_200/0.25)] sm:text-7xl">
            {APP_NAME}
          </h1>
          <p className="max-w-md text-balance text-ink/80 text-lg">{t("home.tagline")}</p>
        </div>
      </header>

      <main className="relative z-10 -mt-24 flex flex-col gap-20 px-6 pb-16">
        <section className="mx-auto w-full max-w-md" aria-label={t("home.createRoom")}>
          <EntryPanel />
        </section>

        <section className="mx-auto w-full max-w-3xl" aria-labelledby="how-to-title">
          <SectionTitle id="how-to-title">{t("home.howTo.title")}</SectionTitle>
          <p className="mx-auto mt-3 max-w-xl text-balance text-center text-ink-muted">
            {t("home.howTo.intro")}
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className="flex gap-4 rounded-xl border border-panel-border bg-panel p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-moon/40 font-display text-moon"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{t(`home.howTo.${step}.title`)}</h3>
                  <p className="mt-1 text-ink-muted text-sm">{t(`home.howTo.${step}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-3xl" aria-labelledby="roles-title">
          <SectionTitle id="roles-title">{t("home.roles.title")}</SectionTitle>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ROLES.map(({ id, icon: Icon, accent }) => (
              <li
                key={id}
                className="group flex flex-col gap-2 rounded-xl border border-panel-border bg-gradient-to-b from-panel to-transparent p-4 transition-colors hover:border-moon/40"
              >
                <Icon
                  aria-hidden="true"
                  className={`size-7 ${accent} transition-transform motion-safe:group-hover:-translate-y-0.5`}
                />
                <h3 className="font-display font-semibold text-lg">{t(`home.roles.${id}.name`)}</h3>
                <p className="text-ink-muted text-sm leading-snug">{t(`home.roles.${id}.text`)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-ink-muted text-sm">
            {t("home.roles.more", { count: ROLE_IDS.length - ROLES.length })}
          </p>
        </section>

        <section className="mx-auto w-full max-w-3xl" aria-labelledby="features-title">
          <SectionTitle id="features-title">{t("home.features.title")}</SectionTitle>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {FEATURES.map(({ id, icon: Icon }) => (
              <li key={id} className="flex gap-3">
                <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-moon" />
                <div>
                  <h3 className="font-semibold">{t(`home.features.${id}.title`)}</h3>
                  <p className="mt-1 text-ink-muted text-sm">{t(`home.features.${id}.text`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mt-auto flex flex-col items-center gap-4 border-panel-border border-t px-6 py-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <AudioToggle />
          <ServerStatusBadge />
        </div>
        <p className="text-ink-muted text-xs">
          {APP_NAME} · {t("home.footer")}
        </p>
      </footer>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-center font-display font-semibold text-2xl sm:text-3xl">
      <span aria-hidden="true" className="mx-auto mb-3 block h-px w-12 bg-moon/40" />
      {children}
    </h2>
  );
}
