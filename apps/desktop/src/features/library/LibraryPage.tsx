import { For, Show } from "solid-js";
import { useTranslation } from "../../shared/i18n";
import type { TranslationKey } from "../../shared/i18n";
import { useUISearch } from "../../shared/state/UISearchContext";
import {
  IconChevronDown,
  IconFolder,
  IconList,
  IconMusic,
  IconPlayCircle,
  IconRefresh,
  IconSearch,
  IconStorage
} from "../../components/icons";
import { MediaList, type MediaContextAction } from "../../components/media/MediaList";
import { SegmentedTabs } from "../../components/page/SegmentedTabs";
import { ManageRootsModal } from "./ManageRootsModal";
import { LibraryGroupedView, LibraryPlaylistPlaceholder } from "./LibraryGroupedView";
import {
  ALL_FOLDERS_VALUE,
  type LibraryListItem,
  type LibraryTab,
  useLibraryDataController
} from "./useLibraryDataController";

interface LibraryPageProps {
  onStateRefresh: (expectedPath?: string | null) => Promise<void>;
  currentTrackPath: string | null;
  isPlaying: boolean;
}

export type { LibraryListItem } from "./useLibraryDataController";

export function LibraryPage(props: LibraryPageProps) {
  const { t } = useTranslation();
  const { query: globalQuery } = useUISearch();
  const controller = useLibraryDataController({ t, globalQuery });

  const handlePlay = async (
    item: LibraryListItem,
    contextItems: readonly LibraryListItem[] = controller.filteredItems()
  ) => {
    try {
      await controller.playItem(item, contextItems);
      await props.onStateRefresh(item.source_path);
    } catch {
      // Feedback is handled inside the controller.
    }
  };

  const handleEnqueue = async (item: LibraryListItem) => {
    try {
      await controller.enqueueItem(item);
    } catch {
      // Feedback is handled inside the controller.
    }
  };

  const handleContextAction = (action: MediaContextAction) => {
    if (action === "copy-path") {
      controller.notifyCopyPath();
    }
  };

  const handlePlayAll = () => {
    const first = controller.filteredItems()[0];
    if (first) {
      void handlePlay(first);
    }
  };

  const subtitleKey = (): TranslationKey =>
    controller.reachedEnd() ? "library.subtitle.complete" : "library.subtitle.more";

  const tabItems = () => [
    { value: "songs", label: t("library.tabs.songs") },
    { value: "artists", label: t("library.tabs.artists") },
    { value: "albums", label: t("library.tabs.albums") },
    { value: "playlists", label: t("library.tabs.playlists") },
    { value: "folders", label: t("library.tabs.folders") }
  ];

  return (
    <section class="panel panel-library panel-page">
      <header class="local-library-head">
        <div class="local-library-title">
          <h1>{t("library.title")}</h1>
          <div
            class="local-library-status"
            aria-label={t(subtitleKey(), { count: controller.folderFilteredItems().length })}
          >
            <span class="local-library-status-item">
              <IconMusic />
              <span>{t("library.status.songCount", { count: controller.folderFilteredItems().length })}</span>
            </span>
            <span class="local-library-status-item">
              <IconStorage />
              <span>{controller.visibleSizeGb().toFixed(2)} GB</span>
            </span>
          </div>
        </div>
        <div class="local-library-menu">
          <div class="local-library-menu-left">
            <button
              type="button"
              class="primary-button page-action local-library-play"
              onClick={handlePlayAll}
              disabled={controller.filteredItems().length === 0 || controller.isFetching()}
            >
              <IconPlayCircle />
              <span>{t("library.action.playAll")}</span>
            </button>
            <button
              type="button"
              class="ghost-button page-action local-library-circle"
              onClick={controller.handleRefresh}
              disabled={controller.isFetching() || controller.isScanning()}
              aria-label={t("library.action.refresh")}
              title={t("library.action.refresh")}
            >
              <IconRefresh />
            </button>
            <button
              type="button"
              class="ghost-button page-action local-library-circle"
              onClick={() => controller.setManageOpen(true)}
              aria-label={t("library.action.manageRoots")}
              title={t("library.action.manageRoots")}
            >
              <IconList />
            </button>
          </div>
          <div class="local-library-menu-right">
            <label class="local-library-search">
              <IconSearch />
              <input
                value={controller.localQuery()}
                placeholder={t("library.tracks.fuzzySearch")}
                autocomplete="off"
                onInput={(event) => controller.setLocalQuery(event.currentTarget.value)}
              />
            </label>
            <label class="local-library-folder-select" aria-label={t("library.folderFilter.label")}>
              <IconFolder />
              <select
                value={controller.selectedFolder()}
                onChange={(event) => controller.setSelectedFolder(event.currentTarget.value)}
              >
                <option value={ALL_FOLDERS_VALUE}>{t("library.folderFilter.all")}</option>
                <For each={controller.folderGroups()}>
                  {(group) => <option value={group.key}>{group.label}</option>}
                </For>
              </select>
              <IconChevronDown />
            </label>
            <SegmentedTabs
              value={controller.activeTab()}
              onChange={(next) => controller.setActiveTab(next as LibraryTab)}
              items={tabItems()}
              ariaLabel={t("library.title")}
            />
          </div>
        </div>
      </header>

      <div class="local-library-router">
        <Show when={controller.activeTab() === "songs"}>
          <Show
            when={controller.filteredItems().length > 0}
            fallback={
              <div class="status-line">
                {controller.allItems().length === 0
                  ? t("library.tracks.emptyAll")
                  : t("library.tracks.emptyFilter")}
              </div>
            }
          >
            <MediaList
              items={controller.filteredItems()}
              currentSourcePath={props.currentTrackPath}
              isPlayingNow={props.isPlaying}
              onPlay={(item) => void handlePlay(item, controller.filteredItems())}
              onEnqueue={(item) => void handleEnqueue(item)}
              onContextAction={handleContextAction}
              isLoading={controller.isFetching()}
              emptyState={t("library.tracks.emptyAll")}
            />
          </Show>
          <Show when={!controller.reachedEnd()}>
            <div class="button-row">
              <button
                type="button"
                class="ghost-button"
                onClick={controller.handleLoadMore}
                disabled={controller.isFetching()}
              >
                {controller.isFetching() ? t("library.tracks.loading") : t("library.tracks.loadMore")}
              </button>
            </div>
          </Show>
        </Show>

        <Show when={controller.activeTab() === "artists"}>
          <LibraryGroupedView
            kind="artists"
            groups={controller.artistGroups()}
            currentTrackPath={props.currentTrackPath}
            isPlaying={props.isPlaying}
            onPlay={(item, groupSongs) => void handlePlay(item, groupSongs)}
            onEnqueue={(item) => void handleEnqueue(item)}
            onContextAction={handleContextAction}
            isLoading={controller.isFetching()}
          />
        </Show>
        <Show when={controller.activeTab() === "albums"}>
          <LibraryGroupedView
            kind="albums"
            groups={controller.albumGroups()}
            currentTrackPath={props.currentTrackPath}
            isPlaying={props.isPlaying}
            onPlay={(item, groupSongs) => void handlePlay(item, groupSongs)}
            onEnqueue={(item) => void handleEnqueue(item)}
            onContextAction={handleContextAction}
            isLoading={controller.isFetching()}
          />
        </Show>
        <Show when={controller.activeTab() === "playlists"}>
          <LibraryPlaylistPlaceholder onManageRoots={() => controller.setManageOpen(true)} />
        </Show>
        <Show when={controller.activeTab() === "folders"}>
          <LibraryGroupedView
            kind="folders"
            groups={controller.folderGroups()}
            currentTrackPath={props.currentTrackPath}
            isPlaying={props.isPlaying}
            onPlay={(item, groupSongs) => void handlePlay(item, groupSongs)}
            onEnqueue={(item) => void handleEnqueue(item)}
            onContextAction={handleContextAction}
            isLoading={controller.isFetching()}
          />
        </Show>
      </div>

      <Show when={controller.feedback().message && controller.feedback().message !== t("library.feedback.initial")}>
        <div
          class={
            controller.feedback().tone === "error"
              ? "local-library-feedback status-error"
              : "local-library-feedback status-line"
          }
        >
          {controller.feedback().message}
        </div>
      </Show>
      <Show when={controller.scanProgress()}>
        {(progress) => (
          <div class="local-library-scan-progress" role="status">
            {t("library.feedback.scanProgress", {
              scanned: progress().scanned,
              indexed: progress().indexed,
              removed: progress().removed
            })}
          </div>
        )}
      </Show>

      <ManageRootsModal
        open={controller.manageOpen()}
        onClose={() => controller.setManageOpen(false)}
        roots={controller.roots()}
        isScanning={controller.isScanning()}
        onAddRoot={controller.handleScan}
        onRescan={controller.handleRescan}
        formatScanTimestamp={controller.formatScanTimestamp}
      />
    </section>
  );
}
