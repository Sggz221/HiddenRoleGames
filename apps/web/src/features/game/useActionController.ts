import type { GameAction, PlayerId, PlayerView } from "@howlsinthedark/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { audioManager } from "../../audio/audioManager";
import type { Result } from "../../net/session";
import { type ActionForm, buildAction, mainAction, type Selection, toggleTarget } from "./model";

export interface ActionController {
  /** The main action available now, if any. */
  action: ReturnType<typeof mainAction>;
  /** Whether tapping this player's avatar picks them. */
  canPick: (id: PlayerId) => boolean;
  /** Whether this player is part of the current choice (sent or being assembled). */
  isPicked: (id: PlayerId) => boolean;
  pick: (id: PlayerId) => void;
  selection: Selection;
  setSelection: (selection: Selection) => void;
  send: (action: GameAction | null) => Promise<void>;
  busy: boolean;
  error: string | null;
}

/** Forms whose targets are chosen by tapping avatars (the rest live in the action dock). */
const AVATAR_FORMS: ReadonlySet<ActionForm> = new Set(["target", "pair", "upToTwo"]);

/**
 * The player's answer to `view.pending`, shared by the avatars (picking targets) and the
 * dock (confirm, skip, potions). Remount per phase to reset the selection.
 */
export function useActionController(
  view: PlayerView,
  choice: GameAction | null,
  onSend: (action: GameAction) => Promise<Result>,
): ActionController {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection>({ targets: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = view.pending;
  const action = pending ? mainAction(pending) : null;

  const send = async (next: GameAction | null) => {
    if (!next) return;
    setBusy(true);
    setError(null);
    const result = await onSend(next);
    setBusy(false);
    if (!result.ok) setError(t(`errors.${result.code}`));
  };

  const canPick = (id: PlayerId) =>
    !busy &&
    action !== null &&
    AVATAR_FORMS.has(action.form) &&
    (pending?.targets.includes(id) ?? false);

  const isPicked = (id: PlayerId) => {
    if (action?.form === "pair" || action?.form === "upToTwo")
      return selection.targets.includes(id);
    if (!choice) return false;
    if ("target" in choice) return choice.target === id;
    if ("targets" in choice) return (choice.targets as readonly PlayerId[]).includes(id);
    return false;
  };

  const pick = (id: PlayerId) => {
    if (!action || !canPick(id)) return;
    audioManager.playEffect("select");
    if (action.form === "target") {
      void send(buildAction(action.type, { targets: [id] }));
    } else {
      setSelection({ targets: toggleTarget(selection.targets, id, 2) });
    }
  };

  return { action, canPick, isPicked, pick, selection, setSelection, send, busy, error };
}
