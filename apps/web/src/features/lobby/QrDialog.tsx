import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyledQr } from "../../components/qr/StyledQr";

interface Props {
  open: boolean;
  code: string;
  link: string;
  onClose: () => void;
}

/**
 * Full-size join QR to hold up to the other players. A native modal `<dialog>` gives focus
 * trapping and Escape for free.
 */
export function QrDialog({ open, code, link, onClose }: Props) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a pointer shortcut; Escape and the close button cover keyboards
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself, not on its content.
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="qr-title"
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-panel-border bg-sky p-0 text-ink shadow-2xl shadow-black/60 backdrop:bg-sky-deep/80 backdrop:backdrop-blur-sm motion-safe:open:animate-[qr-in_220ms_ease-out]"
    >
      <div className="flex flex-col items-center gap-4 p-5">
        <div className="flex w-full items-start justify-between gap-4">
          <div>
            <h2 id="qr-title" className="font-display font-semibold text-xl">
              {t("lobby.qr.title")}
            </h2>
            <p className="text-ink-muted text-sm">{t("lobby.qr.hint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("lobby.qr.close")}
            className="rounded-lg border border-panel-border p-2 text-ink-muted transition-colors hover:text-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {open && (
          <StyledQr
            value={link}
            label={t("lobby.qr.alt", { code })}
            className="w-full drop-shadow-[0_0_28px_rgb(244_233_200/0.25)]"
          />
        )}
        <p className="font-bold font-mono text-3xl text-moon tracking-[0.3em]">{code}</p>
      </div>
    </dialog>
  );
}
