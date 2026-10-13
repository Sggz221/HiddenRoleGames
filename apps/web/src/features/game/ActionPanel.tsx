import type { GameAction, PlayerId, PlayerView, Side } from "@howlsinthedark/shared";
import { Check } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Result } from "../../net/session";
import { allowsNobody, buildAction, mainAction, type Selection, toggleTarget } from "./model";

interface Props {
  view: PlayerView;
  /** What the player already sent in this phase (they may still change it). */
  choice: GameAction | null;
  onSend: (action: GameAction) => Promise<Result>;
}

/**
 * Renders exactly what the server says the player may do now (`view.pending`): the targets
 * are the server's list, never computed here. Remount it per phase to reset the selection.
 */
export function ActionPanel({ view, choice, onSend }: Props) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection>({ targets: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = view.pending;
  const action = pending ? mainAction(pending) : null;
  if (!pending) return null;

  const name = (id: PlayerId) => view.players.find((player) => player.id === id)?.name ?? id;

  const send = async (next: GameAction | null) => {
    if (!next) return;
    setBusy(true);
    setError(null);
    const result = await onSend(next);
    setBusy(false);
    if (!result.ok) setError(t(`errors.${result.code}`));
  };

  const prompt =
    action?.type === "vote" && view.phase.kind === "day" && view.phase.step === "sheriff-election"
      ? t("game.actions.voteSheriff")
      : action
        ? t(`game.actions.${action.type}`)
        : "";

  const chosen = describeChoice(choice, name, t);

  return (
    <section
      aria-labelledby="action-title"
      className="flex flex-col gap-3 rounded-2xl border border-moon/40 bg-panel p-4"
    >
      <h2 id="action-title" className="font-display font-semibold text-xl">
        {prompt}
      </h2>

      {action?.form === "target" && (
        <TargetGrid>
          {pending.targets.map((id) => (
            <TargetButton
              key={id}
              selected={hasTarget(choice, id)}
              disabled={busy}
              onClick={() => void send(buildAction(action.type, { targets: [id] }))}
            >
              {name(id)}
            </TargetButton>
          ))}
          {allowsNobody(action.type) && (
            <TargetButton
              selected={choice !== null && "target" in choice && choice.target === null}
              disabled={busy}
              onClick={() => void send(buildAction(action.type, { targets: [] }))}
            >
              {action.type === "vote" ? t("game.actions.abstain") : t("game.actions.nobody")}
            </TargetButton>
          )}
        </TargetGrid>
      )}

      {(action?.form === "pair" || action?.form === "upToTwo") && (
        <>
          <TargetGrid>
            {pending.targets.map((id) => (
              <TargetButton
                key={id}
                selected={selection.targets.includes(id)}
                disabled={busy}
                onClick={() => setSelection({ targets: toggleTarget(selection.targets, id, 2) })}
              >
                {name(id)}
              </TargetButton>
            ))}
          </TargetGrid>
          <PrimaryButton
            disabled={busy || !buildAction(action.type, selection)}
            onClick={() => void send(buildAction(action.type, selection))}
          >
            {t("game.actions.confirm")}
          </PrimaryButton>
        </>
      )}

      {action?.form === "side" && (
        <TargetGrid>
          {(["village", "wolves"] as const satisfies readonly Side[]).map((side) => (
            <TargetButton
              key={side}
              selected={choice?.type === "wolfHoundChoose" && choice.side === side}
              disabled={busy}
              onClick={() => void send(buildAction("wolfHoundChoose", { targets: [], side }))}
            >
              {t(`game.sides.${side}`)}
            </TargetButton>
          ))}
        </TargetGrid>
      )}

      {action?.form === "infect" && (
        <TargetGrid>
          {[true, false].map((infect) => (
            <TargetButton
              key={String(infect)}
              selected={choice?.type === "infect" && choice.infect === infect}
              disabled={busy}
              onClick={() => void send(buildAction("infect", { targets: [], infect }))}
            >
              {infect ? t("game.actions.yes") : t("game.actions.no")}
            </TargetButton>
          ))}
        </TargetGrid>
      )}

      {action?.form === "witch" && (
        <WitchForm
          view={view}
          name={name}
          selection={selection}
          onChange={setSelection}
          busy={busy}
          onConfirm={() => void send(buildAction("witch", selection))}
        />
      )}

      {pending.types.includes("skip") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void send({ type: "skip" })}
          className="self-start text-ink-muted text-sm underline-offset-4 hover:text-ink hover:underline"
        >
          {t("game.actions.skip")}
        </button>
      )}

      {chosen && (
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          <Check aria-hidden="true" className="size-4 text-emerald-300" />
          {t("game.actions.chosen", { choice: chosen })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-rose-300 text-sm">
          {error}
        </p>
      )}
      <p className="text-ink-muted text-xs">{t("game.actions.changeHint")}</p>
    </section>
  );
}

function WitchForm({
  view,
  name,
  selection,
  onChange,
  busy,
  onConfirm,
}: {
  view: PlayerView;
  name: (id: PlayerId) => string;
  selection: Selection;
  onChange: (selection: Selection) => void;
  busy: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const potions = view.you.witchPotions;
  const victims = view.nightVictims ?? [];
  const targets = view.pending?.targets ?? [];

  const group = (
    label: string,
    available: boolean,
    options: PlayerId[],
    value: PlayerId | null | undefined,
    set: (id: PlayerId | null) => void,
    empty?: string,
  ) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-medium">{label}</legend>
      {!available ? (
        <p className="text-ink-muted text-sm">{t("game.actions.used")}</p>
      ) : options.length === 0 && empty ? (
        <p className="text-ink-muted text-sm">{empty}</p>
      ) : (
        <TargetGrid>
          <TargetButton selected={!value} disabled={busy} onClick={() => set(null)}>
            {t("game.actions.nobody")}
          </TargetButton>
          {options.map((id) => (
            <TargetButton key={id} selected={value === id} disabled={busy} onClick={() => set(id)}>
              {name(id)}
            </TargetButton>
          ))}
        </TargetGrid>
      )}
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-4">
      {group(
        t("game.actions.heal"),
        potions?.heal ?? false,
        victims,
        selection.heal,
        (heal) => onChange({ ...selection, heal }),
        t("game.actions.noVictims"),
      )}
      {group(
        t("game.actions.poison"),
        potions?.poison ?? false,
        targets,
        selection.poison,
        (poison) => onChange({ ...selection, poison }),
      )}
      <PrimaryButton disabled={busy} onClick={onConfirm}>
        {t("game.actions.confirm")}
      </PrimaryButton>
    </div>
  );
}

function hasTarget(choice: GameAction | null, id: PlayerId): boolean {
  if (!choice) return false;
  if ("target" in choice) return choice.target === id;
  if ("targets" in choice) return (choice.targets as readonly PlayerId[]).includes(id);
  return false;
}

function describeChoice(
  choice: GameAction | null,
  name: (id: PlayerId) => string,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (!choice) return null;
  switch (choice.type) {
    case "vote":
    case "sheriffTieBreak":
      return choice.target ? name(choice.target) : t("game.actions.nobody");
    case "cupidLink":
    case "piperCharm":
      return choice.targets.map(name).join(", ");
    case "wolfHoundChoose":
      return t(`game.sides.${choice.side}`);
    case "infect":
      return choice.infect ? t("game.actions.yes") : t("game.actions.no");
    case "witch": {
      const parts = [
        choice.heal && `${t("game.actions.heal")}: ${name(choice.heal)}`,
        choice.poison && `${t("game.actions.poison")}: ${name(choice.poison)}`,
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : t("game.actions.nobody");
    }
    case "skip":
      return null;
    default:
      return name(choice.target);
  }
}

function TargetGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function TargetButton({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className="min-h-12 truncate rounded-xl border border-panel-border px-3 py-2 text-left transition-colors enabled:hover:border-moon disabled:opacity-60 aria-pressed:border-moon aria-pressed:bg-moon aria-pressed:font-semibold aria-pressed:text-sky"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-xl bg-blood px-6 py-3 font-semibold text-white transition-colors enabled:hover:bg-blood-strong disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
