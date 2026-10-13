import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type RevealOnDeath,
  ROLE_IDS,
  ROLES,
  type RoleCategory,
  type RoleId,
  revealOnDeathSchema,
  type VoteTieRule,
  voteTieRuleSchema,
} from "@howlsinthedark/shared";
import { Minus, Plus } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { countsOf, deckFor, type LobbySettings, PACE_TIMERS, PACES, setCount } from "./settings";

const CATEGORIES: readonly RoleCategory[] = ["wolf", "villager", "ambiguous", "loner"];

interface Props {
  settings: LobbySettings;
  players: number;
  onChange: (settings: LobbySettings) => void;
}

/** What the host can tune before dealing the cards. */
export function HostSettings({ settings, players, onChange }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<LobbySettings>) => onChange({ ...settings, ...patch });
  const deck = deckFor(settings, players);
  const timers = PACE_TIMERS[settings.pace];

  return (
    <section
      aria-labelledby="settings-title"
      className="flex flex-col gap-5 rounded-2xl border border-panel-border bg-panel p-4"
    >
      <header>
        <h2 id="settings-title" className="font-display font-semibold text-xl">
          {t("lobby.settings.title")}
        </h2>
        <p className="text-ink-muted text-sm">{t("lobby.settings.hint")}</p>
      </header>

      <Field label={t("lobby.settings.deck")}>
        <Segmented
          value={settings.deck}
          options={[
            ["recommended", t("lobby.settings.recommended")],
            ["custom", t("lobby.settings.custom")],
          ]}
          onChange={(value) =>
            // A new custom deck starts from the one in use, so tweaking it is quick.
            set(value === "custom" ? { deck: value, counts: countsOf(deck) } : { deck: value })
          }
        />
        {settings.deck === "recommended" ? (
          <p className="text-ink-muted text-sm">
            {t("lobby.settings.recommendedHint", { count: Math.max(players, MIN_PLAYERS) })}
          </p>
        ) : (
          <DeckEditor settings={settings} onChange={(counts) => set({ counts })} />
        )}
        {players >= MIN_PLAYERS && (
          <p className="text-ink-muted text-sm" aria-live="polite">
            {t("lobby.settings.cards", { cards: deck.length, players })}
          </p>
        )}
      </Field>

      <Field label={t("lobby.settings.pace")}>
        <Segmented
          value={settings.pace}
          options={PACES.map((pace) => [pace, t(`lobby.settings.paces.${pace}`)] as const)}
          onChange={(pace) => set({ pace })}
        />
        <p className="text-ink-muted text-sm">
          {t("lobby.settings.paceHint", {
            debate: timers.debateSeconds / 60,
            vote: timers.voteSeconds,
            night: timers.nightStepSeconds,
          })}
        </p>
      </Field>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={settings.sheriff}
          onChange={(event) => set({ sheriff: event.target.checked })}
          className="size-5 accent-blood"
        />
        <span>{t("lobby.settings.sheriff")}</span>
      </label>

      <SelectField<RevealOnDeath>
        label={t("lobby.settings.revealOnDeath")}
        value={settings.revealOnDeath}
        options={revealOnDeathSchema.options.map((value) => [
          value,
          t(`lobby.settings.reveal.${value}`),
        ])}
        onChange={(revealOnDeath) => set({ revealOnDeath })}
      />
      <SelectField<VoteTieRule>
        label={t("lobby.settings.voteTieRule")}
        value={settings.voteTieRule}
        options={voteTieRuleSchema.options.map((value) => [
          value,
          t(`lobby.settings.tie.${value}`),
        ])}
        onChange={(voteTieRule) => set({ voteTieRule })}
      />
    </section>
  );
}

function DeckEditor({
  settings,
  onChange,
}: {
  settings: LobbySettings;
  onChange: (counts: LobbySettings["counts"]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      {CATEGORIES.map((category) => (
        <div key={category}>
          <h3 className="mb-2 text-ink-muted text-xs uppercase tracking-widest">
            {t(`lobby.categories.${category}`)}
          </h3>
          <ul className="flex flex-col gap-1">
            {ROLE_IDS.filter((role) => ROLES[role].category === category).map((role) => (
              <RoleCounter
                key={role}
                role={role}
                count={settings.counts[role] ?? 0}
                onChange={(count) => onChange(setCount(settings.counts, role, count))}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RoleCounter({
  role,
  count,
  onChange,
}: {
  role: RoleId;
  count: number;
  onChange: (count: number) => void;
}) {
  const { t } = useTranslation();
  const name = t(`roles.${role}`);
  const max = Math.min(ROLES[role].maxCopies, MAX_PLAYERS);
  const button =
    "flex size-9 items-center justify-center rounded-lg border border-panel-border transition-colors enabled:hover:border-moon disabled:opacity-30";
  return (
    <li className="flex items-center justify-between gap-3">
      <span className={count > 0 ? "" : "text-ink-muted"}>{name}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={count === 0}
          onClick={() => onChange(count - 1)}
          aria-label={t("lobby.settings.remove", { role: name })}
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <output className="w-6 text-center font-mono tabular-nums">{count}</output>
        <button
          type="button"
          className={button}
          disabled={count >= max}
          onClick={() => onChange(count + 1)}
          aria-label={t("lobby.settings.add", { role: name })}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </span>
    </li>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{label}</legend>
      {children}
    </fieldset>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-panel-border p-1">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className="flex-1 rounded-md px-3 py-2 text-sm transition-colors aria-pressed:bg-moon aria-pressed:font-semibold aria-pressed:text-sky"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded-lg border border-panel-border bg-sky-deep px-3 py-2"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
