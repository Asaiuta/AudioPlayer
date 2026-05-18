import { For, Show, createEffect, createMemo, createResource, createSignal, on } from "solid-js";
import { AlbumCard } from "../../components/AlbumCard";
import { IconChevronLeft } from "../../components/icons";
import { MediaList } from "../../components/media/MediaList";
import { PageHeader } from "../../components/page/PageHeader";
import { SegmentedTabs } from "../../components/page/SegmentedTabs";
import { createApiClient } from "../../shared/api/client";
import {
  radioDetail,
  radioCategoryHot,
  radioCategoryRecommend,
  radioCatList,
  radioPrograms,
  radioRecommendType,
  radioToplist
} from "../../shared/api/ncm/radio";
import { useTranslation } from "../../shared/i18n";
import { useUISettings } from "../../shared/state/useUISettings";
import { ncmDjRadioPageUrl } from "../../shared/api/ncm/urls";
import {
  type RadioCategory,
  type RadioCategorySection,
  parseRadioCardsFromKey,
  parseRadioCategories,
  parseRadioCategorySections,
  parseRadioDetailCard,
  parseRadioProgramTracks
} from "./radioParsers";
import { createPlaybackController } from "./shared/playback";
import type { FeedCardItem, Feedback, OnlineTrackItem } from "./shared/types";

type RadioTab = "hot" | "recommend";

const CARD_LIMIT = 20;
const PROGRAM_LIMIT = 100;
const api = createApiClient();

const safeLoad = async <T,>(load: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await load();
  } catch (error) {
    console.warn("[NeteaseRadioPage] radio fetch failed", error);
    return fallback;
  }
};

const openRadioSource = (id: number) => {
  window.open(ncmDjRadioPageUrl(id), "_blank");
};

export interface RadioDetailRequest {
  radio: FeedCardItem | null;
  version: number;
}

export interface NeteaseRadioPageProps {
  radioDetailRequest?: RadioDetailRequest;
  onStateRefresh: (expectedPath?: string | null) => Promise<void>;
  currentTrackPath: string | null;
  currentSongId: number | null;
  isPlaying: boolean;
  onRegisterPlayback: (track: {
    songId: number;
    streamUrl: string;
    sourcePageUrl: string;
    title: string | null;
    artist: string | null;
    album: string | null;
    coverUrl: string | null;
    durationSecs: number | null;
  }) => void;
}

function RadioCardGrid(props: {
  items: FeedCardItem[];
  hiddenCover: boolean;
  emptyText: string;
  onSelectRadio: (radio: FeedCardItem) => void | Promise<void>;
}) {
  return (
    <Show when={props.items.length > 0} fallback={<div class="panel-note">{props.emptyText}</div>}>
      <div class="album-grid">
        <For each={props.items}>
          {(item) => (
            <AlbumCard
              title={item.title}
              subtitle={item.subtitle}
              coverUrl={item.coverUrl}
              coverVisible={!props.hiddenCover}
              playCount={item.playCount}
              description={item.description}
              onClick={() => void props.onSelectRadio(item)}
            />
          )}
        </For>
      </div>
    </Show>
  );
}

export function NeteaseRadioPage(props: NeteaseRadioPageProps) {
  const { t } = useTranslation();
  const uiSettings = useUISettings();
  const [categoriesExpanded, setCategoriesExpanded] = createSignal<boolean>(false);
  const [selectedCategory, setSelectedCategory] = createSignal<RadioCategory | null>(null);
  const [selectedRadio, setSelectedRadio] = createSignal<FeedCardItem | null>(null);
  const [radioTracks, setRadioTracks] = createSignal<OnlineTrackItem[]>([]);
  const [isLoadingRadioTracks, setIsLoadingRadioTracks] = createSignal<boolean>(false);
  const [feedback, setFeedback] = createSignal<Feedback>({ tone: "neutral", message: "" });
  const [categoryTab, setCategoryTab] = createSignal<RadioTab>("hot");

  const playback = createPlaybackController({
    api,
    t,
    onRegisterPlayback: props.onRegisterPlayback,
    onStateRefresh: props.onStateRefresh,
    setFeedback: (tone, message) => setFeedback({ tone, message })
  });

  const [categories] = createResource(() =>
    safeLoad(async () => parseRadioCategories(await radioCatList()), [])
  );

  const [hotRadios] = createResource(() =>
    safeLoad(async () => parseRadioCardsFromKey(await radioToplist({ type: "hot", limit: CARD_LIMIT }), "toplist"), [])
  );

  const [categorySections] = createResource(() =>
    safeLoad(async () => parseRadioCategorySections(await radioCategoryRecommend()), [])
  );

  const [categoryHotRadios] = createResource(
    () => selectedCategory()?.id ?? null,
    (categoryId) =>
      categoryId === null
        ? Promise.resolve<FeedCardItem[]>([])
        : safeLoad(
            async () =>
              parseRadioCardsFromKey(
                await radioCategoryHot({ cateId: categoryId, limit: 50, offset: 0 }),
                "djRadios"
              ),
            []
          )
  );

  const [categoryRecommendRadios] = createResource(
    () => selectedCategory()?.id ?? null,
    (categoryId) =>
      categoryId === null
        ? Promise.resolve<FeedCardItem[]>([])
        : safeLoad(async () => parseRadioCardsFromKey(await radioRecommendType(categoryId), "djRadios"), [])
  );

  const categoryItems = createMemo(() => categories() ?? []);
  const visibleCategories = createMemo(() =>
    categoriesExpanded() ? categoryItems() : categoryItems().slice(0, 20)
  );
  const sections = createMemo<RadioCategorySection[]>(() => categorySections() ?? []);
  const categoryTabs = createMemo(() => [
    { value: "hot", label: t("ncm.radio.tab.hot") },
    { value: "recommend", label: t("ncm.radio.tab.recommend") }
  ]);
  const activeCategoryItems = createMemo(() =>
    categoryTab() === "hot" ? categoryHotRadios() ?? [] : categoryRecommendRadios() ?? []
  );
  const isLoadingCategory = createMemo(() =>
    categoryTab() === "hot" ? categoryHotRadios.loading : categoryRecommendRadios.loading
  );
  const emptyText = () => t("ncm.radio.empty");
  const radioDetailTitle = () => selectedRadio()?.title ?? t("ncm.radio.title");

  const loadRadioDetail = async (radio: FeedCardItem) => {
    setSelectedCategory(null);
    setSelectedRadio(radio);
    setRadioTracks([]);
    setIsLoadingRadioTracks(true);
    try {
      const [detailPayload, programsPayload] = await Promise.all([
        radioDetail({ rid: radio.id }),
        radioPrograms({ rid: radio.id, limit: PROGRAM_LIMIT, offset: 0 })
      ]);
      setSelectedRadio(parseRadioDetailCard(detailPayload) ?? radio);
      setRadioTracks(parseRadioProgramTracks(programsPayload));
    } catch (error) {
      console.warn("[NeteaseRadioPage] radio detail fetch failed", error);
      setFeedback({ tone: "error", message: t("ncm.radio.empty") });
    } finally {
      setIsLoadingRadioTracks(false);
    }
  };

  createEffect(() => {
    if (selectedCategory() !== null) setCategoryTab("hot");
  });

  createEffect(
    on(
      () => props.radioDetailRequest?.version,
      (version) => {
        if (version === undefined || version === 0) return;
        const radio = props.radioDetailRequest?.radio;
        if (!radio) return;
        void loadRadioDetail(radio);
      }
    )
  );

  return (
    <div class="panel panel-page online-page is-discover-page radio-page">
      <Show
        when={selectedRadio()}
        fallback={
          <Show
            when={selectedCategory()}
            fallback={
              <>
                <PageHeader title={t("ncm.radio.title")} meta={<span>{t("ncm.radio.meta")}</span>} />

                <section class="radio-type">
                  <Show when={visibleCategories().length > 0} fallback={<div class="radio-category-grid is-loading" />}>
                    <div class="radio-category-grid">
                      <For each={visibleCategories()}>
                        {(item) => (
                          <button type="button" class="radio-category-card" onClick={() => setSelectedCategory(item)}>
                            <span>{item.name}</span>
                          </button>
                        )}
                      </For>
                      <Show when={categoryItems().length > 20}>
                        <button
                          type="button"
                          class="radio-category-card radio-category-card--toggle"
                          onClick={() => setCategoriesExpanded(!categoriesExpanded())}
                        >
                          <span>{categoriesExpanded() ? t("ncm.radio.categories.collapse") : t("ncm.radio.categories.expand")}</span>
                        </button>
                      </Show>
                    </div>
                  </Show>
                </section>

                <section class="online-discover-section radio-rec">
                  <div class="radio-section-title">
                    <h2>{t("ncm.radio.section.hot")}</h2>
                  </div>
                  <RadioCardGrid items={hotRadios() ?? []} hiddenCover={uiSettings.hiddenCovers.radio} emptyText={emptyText()} onSelectRadio={(radio) => void loadRadioDetail(radio)} />
                </section>

                <For each={sections()}>
                  {(section) => (
                    <section class="online-discover-section radio-rec">
                      <button
                        type="button"
                        class="radio-section-title radio-section-title--clickable"
                        onClick={() => setSelectedCategory({ id: section.id, name: section.name })}
                      >
                        <h2>{section.name}</h2>
                        <span aria-hidden="true">›</span>
                      </button>
                      <RadioCardGrid items={section.radios} hiddenCover={uiSettings.hiddenCovers.radio} emptyText={emptyText()} onSelectRadio={(radio) => void loadRadioDetail(radio)} />
                    </section>
                  )}
                </For>
              </>
            }
          >
            {(category) => (
              <>
                <PageHeader
                  title={category().name}
                  actions={
                    <button type="button" class="ghost-button radio-back-button" onClick={() => setSelectedCategory(null)}>
                      <IconChevronLeft />
                      {t("ncm.radio.back")}
                    </button>
                  }
                  tabs={
                    <SegmentedTabs
                      value={categoryTab()}
                      onChange={(next) => setCategoryTab(next as RadioTab)}
                      items={categoryTabs()}
                      ariaLabel={t("ncm.radio.tabs.aria")}
                    />
                  }
                />
                <section class="online-discover-section radio-rec">
                  <RadioCardGrid
                    items={activeCategoryItems()}
                    hiddenCover={uiSettings.hiddenCovers.radio}
                    emptyText={emptyText()}
                    onSelectRadio={(radio) => void loadRadioDetail(radio)}
                  />
                  <Show when={isLoadingCategory()}>
                    <div class="panel-note">{t("ncm.radio.loading")}</div>
                  </Show>
                </section>
              </>
            )}
          </Show>
        }
      >
        {(radio) => (
          <>
            <PageHeader
              title={radioDetailTitle()}
              meta={<span>{radio().subtitle ?? t("ncm.radio.meta")}</span>}
              actions={
                <button type="button" class="ghost-button radio-back-button" onClick={() => {
                  setSelectedRadio(null);
                  setRadioTracks([]);
                }}>
                  <IconChevronLeft />
                  {t("ncm.radio.back")}
                </button>
              }
            />
            <section class="online-discover-section radio-rec">
              <MediaList
                items={radioTracks()}
                currentSourcePath={props.currentTrackPath}
                currentSongId={props.currentSongId}
                isPlayingNow={props.isPlaying}
                hideArtwork={uiSettings.hiddenCovers.radio}
                onPlay={(item) => void playback.playOnlineTrack(item)}
                onEnqueue={(item) => void playback.enqueueOnlineTrack(item)}
                isLoading={isLoadingRadioTracks()}
                emptyState={<div class="panel-note">{emptyText()}</div>}
              />
              <Show when={feedback().tone === "error"}>
                <div class="panel-note">{feedback().message}</div>
              </Show>
              <button type="button" class="ghost-button" onClick={() => openRadioSource(radio().id)}>
                {t("ncm.playlist.openSource")}
              </button>
            </section>
          </>
        )}
      </Show>
    </div>
  );
}
