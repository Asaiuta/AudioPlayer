import type { TranslationKey } from "../../../shared/i18n";
import { useTranslation } from "../../../shared/i18n";
import { SettingItem, settingsSectionClass } from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";

interface UnavailableSettingsSectionProps {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}

export function UnavailableSettingsSection(props: UnavailableSettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t(props.titleKey)}>
        <SettingItem
          id="categoryUnavailable"
          label={t("settings.categoryUnavailable.title")}
          description={t(props.descriptionKey)}
          index={0}
        >
          <button type="button" class="ghost-button" disabled>
            {t("settings.categoryUnavailable.action")}
          </button>
        </SettingItem>
      </SettingGroup>
    </section>
  );
}
