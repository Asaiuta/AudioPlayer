import { createSignal } from "solid-js";
import { albumDetailDynamic, albumSub } from "../../../../shared/api/ncm/search";
import {
  createAlbumDetailInfo,
  parseAlbumDynamicInfo,
  type AlbumDetailInfo
} from "../../albumParsers";
import type { FeedCardItem, OnlineTrackItem } from "../types";
import { createSubscribeToggle } from "./collectionSubscribeToggle";
import type { CollectionSubscribeCallbacks, DetailNavigationBaseContext } from "./types";

export interface AlbumDetailNavigationContext
  extends DetailNavigationBaseContext,
    Pick<CollectionSubscribeCallbacks, "onAlbumSubscribeChange"> {
  clearAllDetailViews: () => void;
}

const toAlbumEventItem = (album: FeedCardItem, detail: AlbumDetailInfo | null): FeedCardItem => ({
  id: detail?.id ?? album.id,
  title: detail?.title ?? album.title,
  subtitle: detail?.subtitle ?? album.subtitle,
  coverUrl: detail?.coverUrl ?? album.coverUrl,
  playCount: detail?.playCount ?? album.playCount,
  description: detail?.description ?? album.description
});

export function createAlbumDetailNavigation(ctx: AlbumDetailNavigationContext) {
  const [selectedAlbum, setSelectedAlbum] = createSignal<FeedCardItem | null>(null);
  const [albumDetailInfo, setAlbumDetailInfo] = createSignal<AlbumDetailInfo | null>(null);
  const [albumTracksState, setAlbumTracksState] = createSignal<OnlineTrackItem[]>([]);
  const [isLoadingAlbumTracks, setIsLoadingAlbumTracks] = createSignal<boolean>(false);
  const [isLoadingAlbumDetail, setIsLoadingAlbumDetail] = createSignal<boolean>(false);
  const [isTogglingAlbumSubscribe, setIsTogglingAlbumSubscribe] = createSignal<boolean>(false);

  const loadAlbumTracks = async (albumItem: FeedCardItem) => {
    ctx.clearAllDetailViews();
    setSelectedAlbum(albumItem);
    setAlbumDetailInfo(null);
    setIsLoadingAlbumDetail(true);
    setIsLoadingAlbumTracks(true);
    void albumDetailDynamic(albumItem.id)
      .then((payload) => {
        if (selectedAlbum()?.id !== albumItem.id) return;
        setAlbumDetailInfo(createAlbumDetailInfo(albumItem, parseAlbumDynamicInfo(payload)));
      })
      .catch(() => {
        if (selectedAlbum()?.id !== albumItem.id) return;
        setAlbumDetailInfo(createAlbumDetailInfo(albumItem, null));
      })
      .finally(() => {
        if (selectedAlbum()?.id === albumItem.id) {
          setIsLoadingAlbumDetail(false);
        }
      });
    try {
      setAlbumTracksState(await ctx.api.listNcmAlbumTracks(albumItem.id));
    } catch (error) {
      setAlbumTracksState([]);
      ctx.setFeedback("error", ctx.readErrorMessage(error));
    } finally {
      setIsLoadingAlbumTracks(false);
    }
  };

  const clearAlbumDetail = () => {
    setSelectedAlbum(null);
    setAlbumDetailInfo(null);
    setAlbumTracksState([]);
    setIsLoadingAlbumDetail(false);
    setIsTogglingAlbumSubscribe(false);
  };

  const toggleAlbumSubscribe = createSubscribeToggle({
    ctx,
    selectedItem: selectedAlbum,
    selectedId: (album) => album.id,
    isToggling: isTogglingAlbumSubscribe,
    setIsToggling: setIsTogglingAlbumSubscribe,
    detail: albumDetailInfo,
    readSubscribed: (detail) => detail?.subscribed ?? false,
    requestToggle: albumSub,
    applySubscribed: (album, subscribed) => {
      setAlbumDetailInfo((current) => ({
        ...(current ?? createAlbumDetailInfo(album, null)),
        subscribed
      }));
    },
    createEventItem: toAlbumEventItem,
    onChange: ctx.onAlbumSubscribeChange,
    messages: {
      loginRequired: "ncm.album.loginRequired",
      subscribeSuccess: "ncm.album.subscribeSuccess",
      unsubscribeSuccess: "ncm.album.unsubscribeSuccess"
    }
  });

  return {
    selectedAlbum,
    albumDetailInfo,
    albumTracksState,
    isLoadingAlbumTracks,
    isLoadingAlbumDetail,
    isTogglingAlbumSubscribe,
    loadAlbumTracks,
    toggleAlbumSubscribe,
    exitAlbum: clearAlbumDetail,
    clearAlbumDetail
  };
}
