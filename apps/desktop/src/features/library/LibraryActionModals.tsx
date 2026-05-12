import { For, Show, createEffect, createSignal } from "solid-js";
import { Modal } from "../../components/Modal";
import { IconPlaylist, IconPlus } from "../../components/icons";
import type { LocalPlaylist } from "../../shared/api/types";
import { useTranslation } from "../../shared/i18n";
import type { LibraryListItem } from "./useLibraryDataController";

interface LibraryPlaylistTargetModalProps {
  open: boolean;
  items: readonly LibraryListItem[];
  playlists: readonly LocalPlaylist[];
  onClose: () => void;
  onAddToPlaylist: (playlistId: string, items: readonly LibraryListItem[]) => Promise<void>;
  onCreateAndAdd: (
    name: string,
    description: string | null,
    items: readonly LibraryListItem[]
  ) => Promise<void>;
}

interface LibraryConfirmActionModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function LibraryPlaylistTargetModal(props: LibraryPlaylistTargetModalProps) {
  const { t } = useTranslation();
  const [name, setName] = createSignal<string>("");
  const [description, setDescription] = createSignal<string>("");
  const [submittingPlaylistId, setSubmittingPlaylistId] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal<boolean>(false);
  const hasItems = () => props.items.length > 0;

  createEffect(() => {
    if (props.open) return;
    setName("");
    setDescription("");
    setSubmittingPlaylistId(null);
    setCreating(false);
  });

  const handleAdd = async (playlistId: string) => {
    setSubmittingPlaylistId(playlistId);
    try {
      await props.onAddToPlaylist(playlistId, props.items);
      props.onClose();
    } finally {
      setSubmittingPlaylistId(null);
    }
  };

  const handleCreate = async () => {
    const trimmedName = name().trim();
    if (!trimmedName) return;
    setCreating(true);
    try {
      const trimmedDescription = description().trim();
      await props.onCreateAndAdd(
        trimmedName,
        trimmedDescription.length > 0 ? trimmedDescription : null,
        props.items
      );
      props.onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={hasItems() ? t("library.playlists.add.title") : t("library.playlists.create.title")}
      closeAriaLabel={t("library.modal.manageRoots.close")}
      onClose={props.onClose}
      size="md"
    >
      <div class="local-action-modal">
        <Show when={hasItems()}>
          <div class="local-action-summary">
            {t("library.playlists.add.summary", { count: props.items.length })}
          </div>
        </Show>

        <Show when={hasItems()}>
          <Show
            when={props.playlists.length > 0}
            fallback={<div class="status-line">{t("library.playlists.empty")}</div>}
          >
            <div class="local-playlist-target-list">
              <For each={props.playlists}>
                {(playlist) => (
                  <button
                    type="button"
                    class="local-playlist-target"
                    onClick={() => void handleAdd(playlist.playlist_id)}
                    disabled={submittingPlaylistId() !== null || creating()}
                  >
                    <span class="local-playlist-target-icon" aria-hidden="true">
                      <IconPlaylist />
                    </span>
                    <span class="local-playlist-target-copy">
                      <span class="local-playlist-target-name">{playlist.name}</span>
                      <span class="local-playlist-target-count">
                        {t("library.group.songCount", { count: playlist.track_count })}
                      </span>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </Show>

        <div class="local-playlist-create-inline">
          <span class="field-label">{t("library.playlists.create.title")}</span>
          <input
            class="text-input"
            type="text"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            placeholder={t("library.playlists.create.namePlaceholder")}
          />
          <input
            class="text-input"
            type="text"
            value={description()}
            onInput={(event) => setDescription(event.currentTarget.value)}
            placeholder={t("library.playlists.create.descriptionPlaceholder")}
          />
          <button
            type="button"
            class="primary-button"
            onClick={() => void handleCreate()}
            disabled={!name().trim() || creating() || submittingPlaylistId() !== null}
          >
            <IconPlus />
            <span>{hasItems() ? t("library.playlists.createAndAdd") : t("library.action.createPlaylist")}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function LibraryConfirmActionModal(props: LibraryConfirmActionModalProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = createSignal<boolean>(false);

  createEffect(() => {
    if (props.open) return;
    setSubmitting(false);
  });

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await props.onConfirm();
      props.onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={props.title}
      closeAriaLabel={t("library.modal.manageRoots.close")}
      onClose={props.onClose}
      size="sm"
      footer={
        <div class="button-row local-confirm-actions">
          <button
            type="button"
            class="ghost-button"
            onClick={props.onClose}
            disabled={submitting()}
          >
            {t("library.action.cancel")}
          </button>
          <button
            type="button"
            class="primary-button danger-button"
            onClick={() => void handleConfirm()}
            disabled={submitting()}
          >
            {props.confirmLabel}
          </button>
        </div>
      }
    >
      <div class="local-action-summary">{props.body}</div>
    </Modal>
  );
}
