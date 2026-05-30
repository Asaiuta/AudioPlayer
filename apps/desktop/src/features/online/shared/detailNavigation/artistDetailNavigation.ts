import { createSignal } from "solid-js";
import type { NcmArtistTrackOrder } from "../../../../shared/api/ncmDomainTypes";
import {
  artistAlbum,
  artistDetail,
  artistMv,
  artistSub
} from "../../../../shared/api/ncm/search";
import { parseArtistDetailInfo, type ArtistDetailInfo } from "../../artistParsers";
import { parseNcmArtistAlbums, parseNcmArtistVideos } from "../../searchParsers";
import type { FeedCardItem, OnlineTrackItem } from "../types";
import { createSubscribeToggle } from "./collectionSubscribeToggle";
import type { CollectionSubscribeCallbacks, DetailNavigationBaseContext } from "./types";

const ARTIST_RESOURCE_PAGE_SIZE = 50;
const ARTIST_TRACK_PAGE_SIZE = 50;

export interface ArtistDetailNavigationContext
  extends DetailNavigationBaseContext,
    Pick<CollectionSubscribeCallbacks, "onArtistSubscribeChange"> {
  clearAllDetailViews: () => void;
}

const toArtistEventItem = (artist: FeedCardItem, detail: ArtistDetailInfo | null): FeedCardItem => ({
  id: detail?.id ?? artist.id,
  title: detail?.title ?? artist.title,
  subtitle: detail?.subtitle ?? artist.subtitle,
  coverUrl: detail?.coverUrl ?? artist.coverUrl,
  playCount: detail?.playCount ?? artist.playCount,
  description: detail?.description ?? artist.description
});

export function createArtistDetailNavigation(ctx: ArtistDetailNavigationContext) {
  const [selectedArtist, setSelectedArtist] = createSignal<FeedCardItem | null>(null);
  const [artistDetailInfo, setArtistDetailInfo] = createSignal<ArtistDetailInfo | null>(null);
  const [artistTracksState, setArtistTracksState] = createSignal<OnlineTrackItem[]>([]);
  const [isLoadingArtistTracks, setIsLoadingArtistTracks] = createSignal<boolean>(false);
  const [isLoadingArtistDetail, setIsLoadingArtistDetail] = createSignal<boolean>(false);
  const [isTogglingArtistSubscribe, setIsTogglingArtistSubscribe] = createSignal<boolean>(false);
  const [artistTrackOrder, setArtistTrackOrder] = createSignal<NcmArtistTrackOrder>("hot");
  const [artistTracksHasMore, setArtistTracksHasMore] = createSignal<boolean>(false);
  const [artistAlbumsState, setArtistAlbumsState] = createSignal<FeedCardItem[]>([]);
  const [artistVideosState, setArtistVideosState] = createSignal<FeedCardItem[]>([]);
  const [isLoadingArtistAlbums, setIsLoadingArtistAlbums] = createSignal<boolean>(false);
  const [isLoadingArtistVideos, setIsLoadingArtistVideos] = createSignal<boolean>(false);
  const [artistAlbumsHasMore, setArtistAlbumsHasMore] = createSignal<boolean>(false);
  const [artistVideosHasMore, setArtistVideosHasMore] = createSignal<boolean>(false);

  const clearArtistResources = () => {
    setArtistTrackOrder("hot");
    setArtistTracksHasMore(false);
    setArtistAlbumsState([]);
    setArtistVideosState([]);
    setArtistAlbumsHasMore(false);
    setArtistVideosHasMore(false);
  };

  const loadArtistTrackPage = async (options: { append?: boolean; order?: NcmArtistTrackOrder } = {}) => {
    const artist = selectedArtist();
    if (!artist || isLoadingArtistTracks()) return;
    const append = options.append === true;
    const order = options.order ?? artistTrackOrder();
    try {
      setIsLoadingArtistTracks(true);
      const page = await ctx.api.listNcmArtistTracks({
        id: artist.id,
        limit: ARTIST_TRACK_PAGE_SIZE,
        offset: append ? artistTracksState().length : 0,
        order
      });
      if (selectedArtist()?.id !== artist.id) return;
      setArtistTrackOrder(order);
      setArtistTracksState((current) => append ? [...current, ...page.tracks] : page.tracks);
      setArtistTracksHasMore(page.hasMore);
    } catch (error) {
      if (selectedArtist()?.id !== artist?.id) return;
      if (!append) {
        setArtistTracksState([]);
        setArtistTracksHasMore(false);
      }
      ctx.setFeedback("error", ctx.readErrorMessage(error));
    } finally {
      if (selectedArtist()?.id === artist?.id) {
        setIsLoadingArtistTracks(false);
      }
    }
  };

  const loadArtistTracks = async (artistItem: FeedCardItem) => {
    ctx.clearAllDetailViews();
    setSelectedArtist(artistItem);
    setArtistDetailInfo(null);
    clearArtistResources();
    setIsLoadingArtistDetail(true);
    void artistDetail(artistItem.id)
      .then((payload) => {
        if (selectedArtist()?.id !== artistItem.id) return;
        setArtistDetailInfo(parseArtistDetailInfo(payload, artistItem));
      })
      .catch((error) => {
        if (selectedArtist()?.id !== artistItem.id) return;
        setArtistDetailInfo(null);
        ctx.setFeedback("error", ctx.readErrorMessage(error));
      })
      .finally(() => {
        if (selectedArtist()?.id === artistItem.id) {
          setIsLoadingArtistDetail(false);
        }
      });
    await loadArtistTrackPage({ order: "hot" });
  };

  const changeArtistTrackOrder = async (order: NcmArtistTrackOrder) => {
    if (order === artistTrackOrder() && artistTracksState().length > 0) return;
    setArtistTracksState([]);
    setArtistTracksHasMore(false);
    await loadArtistTrackPage({ order });
  };

  const loadArtistAlbums = async (options: { append?: boolean } = {}) => {
    const artist = selectedArtist();
    if (!artist || isLoadingArtistAlbums()) return;
    const append = options.append === true;
    setIsLoadingArtistAlbums(true);
    try {
      const payload = parseNcmArtistAlbums(await artistAlbum({
        id: artist.id,
        limit: ARTIST_RESOURCE_PAGE_SIZE,
        offset: append ? artistAlbumsState().length : 0
      }));
      if (selectedArtist()?.id !== artist.id) return;
      setArtistAlbumsState((current) => append ? [...current, ...payload.items] : payload.items);
      setArtistAlbumsHasMore(payload.hasMore);
    } catch (error) {
      if (selectedArtist()?.id !== artist.id) return;
      if (!append) {
        setArtistAlbumsState([]);
        setArtistAlbumsHasMore(false);
      }
      ctx.setFeedback("error", ctx.readErrorMessage(error));
    } finally {
      if (selectedArtist()?.id === artist.id) {
        setIsLoadingArtistAlbums(false);
      }
    }
  };

  const loadArtistVideos = async (options: { append?: boolean } = {}) => {
    const artist = selectedArtist();
    if (!artist || isLoadingArtistVideos()) return;
    const append = options.append === true;
    setIsLoadingArtistVideos(true);
    try {
      const payload = parseNcmArtistVideos(await artistMv({
        id: artist.id,
        limit: ARTIST_RESOURCE_PAGE_SIZE,
        offset: append ? artistVideosState().length : 0
      }));
      if (selectedArtist()?.id !== artist.id) return;
      setArtistVideosState((current) => append ? [...current, ...payload.items] : payload.items);
      setArtistVideosHasMore(payload.hasMore);
    } catch (error) {
      if (selectedArtist()?.id !== artist.id) return;
      if (!append) {
        setArtistVideosState([]);
        setArtistVideosHasMore(false);
      }
      ctx.setFeedback("error", ctx.readErrorMessage(error));
    } finally {
      if (selectedArtist()?.id === artist.id) {
        setIsLoadingArtistVideos(false);
      }
    }
  };

  const clearArtistDetail = () => {
    setSelectedArtist(null);
    setArtistDetailInfo(null);
    setArtistTracksState([]);
    clearArtistResources();
    setIsLoadingArtistDetail(false);
    setIsTogglingArtistSubscribe(false);
    setIsLoadingArtistAlbums(false);
    setIsLoadingArtistVideos(false);
  };

  const toggleArtistSubscribe = createSubscribeToggle({
    ctx,
    selectedItem: selectedArtist,
    selectedId: (artist) => artist.id,
    isToggling: isTogglingArtistSubscribe,
    setIsToggling: setIsTogglingArtistSubscribe,
    detail: artistDetailInfo,
    readSubscribed: (detail) => detail?.followed ?? false,
    requestToggle: artistSub,
    applySubscribed: (artist, followed) => {
      setArtistDetailInfo((current) => ({
        ...(current ?? parseArtistDetailInfo({}, artist)),
        followed
      }));
    },
    createEventItem: toArtistEventItem,
    onChange: ctx.onArtistSubscribeChange,
    messages: {
      loginRequired: "ncm.artist.loginRequired",
      subscribeSuccess: "ncm.artist.subscribeSuccess",
      unsubscribeSuccess: "ncm.artist.unsubscribeSuccess"
    }
  });

  return {
    selectedArtist,
    artistDetailInfo,
    artistTracksState,
    isLoadingArtistTracks,
    isLoadingArtistDetail,
    isTogglingArtistSubscribe,
    artistTrackOrder,
    artistTracksHasMore,
    artistAlbumsState,
    artistVideosState,
    isLoadingArtistAlbums,
    isLoadingArtistVideos,
    artistAlbumsHasMore,
    artistVideosHasMore,
    loadArtistTracks,
    loadArtistTrackPage,
    changeArtistTrackOrder,
    loadArtistAlbums,
    loadArtistVideos,
    toggleArtistSubscribe,
    exitArtist: clearArtistDetail,
    clearArtistDetail
  };
}
