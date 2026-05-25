import { useTranslation } from "../../../shared/i18n";

const wipBadgeClass =
  "inline-flex items-center rounded-pill bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-600 uppercase tracking-wide text-accent";

export function WipBadge() {
  const { t } = useTranslation();
  return (
    <span class={wipBadgeClass} aria-label={t("settings.wip.badge")}>
      {t("settings.wip.badge")}
    </span>
  );
}
