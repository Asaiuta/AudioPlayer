import { Show, createEffect, createMemo, createSignal } from "solid-js";
import { settingsSectionClass } from "../components/SettingItem";
import { AppearanceMainPanel } from "./AppearanceMainPanel";
import { AppearanceSubPanel } from "./AppearanceSubPanel";
import {
  CONTEXT_MENU_ITEMS,
  COVER_DISPLAY_ITEMS,
  COVER_MANAGER_ITEM,
  LAYOUT_MANAGER_ITEMS,
  PLAYLIST_PAGE_ITEMS,
  SIDEBAR_VISIBILITY_ITEMS,
  type AppearanceSubPanel as AppearanceSubPanelId,
  type ManagerConfig
} from "./appearanceConfig";
import { useAppearanceSettings } from "./useAppearanceSettings";

interface AppearanceSectionProps {
  highlightId: string | null;
}

const ALL_MANAGER_ITEMS: readonly ManagerConfig[] = [
  ...LAYOUT_MANAGER_ITEMS,
  COVER_MANAGER_ITEM
];

export function AppearanceSection(props: AppearanceSectionProps) {
  const [activeSubPanel, setActiveSubPanel] = createSignal<AppearanceSubPanelId | null>(null);
  const settings = useAppearanceSettings();

  const activeManager = createMemo<ManagerConfig | null>(() => {
    const panel = activeSubPanel();
    if (panel === null) return null;
    return ALL_MANAGER_ITEMS.find((item) => item.panel === panel) ?? null;
  });

  const managerHighlighted = (item: ManagerConfig) => {
    const highlightedId = props.highlightId;
    if (highlightedId === null) return false;
    if (highlightedId === item.itemId || highlightedId === `${item.itemId}.all`) return true;

    switch (item.panel) {
      case "sidebar":
        return SIDEBAR_VISIBILITY_ITEMS.some((entry) => entry.itemId === highlightedId);
      case "homeSections":
        return highlightedId === "homeSections";
      case "playlistPage":
        return PLAYLIST_PAGE_ITEMS.some((entry) => entry.itemId === highlightedId);
      case "fullPlayerElements":
        return highlightedId.startsWith("fullPlayerShow");
      case "contextMenu":
        return CONTEXT_MENU_ITEMS.some((entry) => entry.itemId === highlightedId);
      case "cover":
        return (
          highlightedId === "hiddenCovers.all" ||
          COVER_DISPLAY_ITEMS.some((entry) => entry.itemId === highlightedId)
        );
      default: {
        const _exhaustive: never = item.panel;
        return _exhaustive;
      }
    }
  };

  createEffect(() => {
    const highlightedId = props.highlightId;
    if (highlightedId === null) return;
    const manager = ALL_MANAGER_ITEMS.find(managerHighlighted);
    if (manager) {
      setActiveSubPanel(manager.panel);
    }
  });

  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  return (
    <section class={settingsSectionClass}>
      <Show when={activeManager()} keyed>
        {(manager) => (
          <AppearanceSubPanel
            manager={manager}
            settings={settings}
            highlightId={props.highlightId}
            nextIndex={nextIndex}
            onBack={() => setActiveSubPanel(null)}
          />
        )}
      </Show>

      <Show when={!activeManager()}>
        <AppearanceMainPanel
          settings={settings}
          highlightId={props.highlightId}
          nextIndex={nextIndex}
          managerHighlighted={managerHighlighted}
          onOpenSubPanel={setActiveSubPanel}
        />
      </Show>
    </section>
  );
}
