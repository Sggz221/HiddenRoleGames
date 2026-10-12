import { useTranslation } from "react-i18next";
import { useServerHealth } from "../net/useServerHealth";

const DOT_CLASS = {
  checking: "bg-ink-muted",
  online: "bg-emerald-400",
  offline: "bg-blood",
} as const;

export function ServerStatusBadge() {
  const { t } = useTranslation();
  const status = useServerHealth();

  return (
    <p role="status" className="flex items-center gap-2 text-xs text-ink-muted">
      <span aria-hidden="true" className={`size-2 rounded-full ${DOT_CLASS[status]}`} />
      {t(`server.${status}`)}
    </p>
  );
}
