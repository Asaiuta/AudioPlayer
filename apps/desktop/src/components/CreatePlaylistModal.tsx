import { For, Show, createEffect, createSignal } from "solid-js";
import { Modal } from "./Modal";
import { IconPlus } from "./icons";
import { createPlaylist, type NcmCreatePlaylistType } from "../shared/api/ncm";
import { useTranslation } from "../shared/i18n";

type FeedbackTone = "success" | "error";

interface CreatePlaylistModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const PLAYLIST_TYPES: ReadonlyArray<{
  value: NcmCreatePlaylistType;
  labelKey: "playlist.create.type.normal" | "playlist.create.type.video" | "playlist.create.type.shared";
  disabled?: boolean;
}> = [
  { value: "NORMAL", labelKey: "playlist.create.type.normal" },
  { value: "VIDEO", labelKey: "playlist.create.type.video", disabled: true },
  { value: "SHARED", labelKey: "playlist.create.type.shared", disabled: true }
];

const readErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function CreatePlaylistModal(props: CreatePlaylistModalProps) {
  const { t } = useTranslation();
  const [name, setName] = createSignal<string>("");
  const [type, setType] = createSignal<NcmCreatePlaylistType>("NORMAL");
  const [privacy, setPrivacy] = createSignal<boolean>(false);
  const [submitting, setSubmitting] = createSignal<boolean>(false);
  const [feedback, setFeedback] = createSignal<{ tone: FeedbackTone; message: string } | null>(null);

  createEffect(() => {
    if (props.open) return;
    setName("");
    setType("NORMAL");
    setPrivacy(false);
    setSubmitting(false);
    setFeedback(null);
  });

  const handleSubmit = async () => {
    const trimmedName = name().trim();
    if (!trimmedName || submitting()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await createPlaylist(trimmedName, privacy(), type());
      if (typeof result.code === "number" && result.code !== 200) {
        throw new Error(
          typeof result.message === "string"
            ? result.message
            : typeof result.msg === "string"
              ? result.msg
              : t("playlist.create.feedback.failed")
        );
      }
      await props.onCreated();
      setFeedback({
        tone: "success",
        message: t("playlist.create.feedback.created", { name: trimmedName })
      });
      props.onClose();
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={t("playlist.create.title")}
      closeAriaLabel={t("library.modal.manageRoots.close")}
      onClose={props.onClose}
      size="md"
    >
      <form
        class="create-playlist-modal"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label class="create-playlist-field">
          <span class="field-label">{t("playlist.create.name")}</span>
          <input
            class="text-input"
            type="text"
            value={name()}
            placeholder={t("playlist.create.namePlaceholder")}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>

        <label class="create-playlist-field">
          <span class="field-label">{t("playlist.create.type")}</span>
          <select
            class="text-input"
            value={type()}
            onChange={(event) => setType(event.currentTarget.value as NcmCreatePlaylistType)}
          >
            <For each={PLAYLIST_TYPES}>
              {(option) => (
                <option value={option.value} disabled={option.disabled}>
                  {t(option.labelKey)}
                </option>
              )}
            </For>
          </select>
        </label>

        <label class="create-playlist-switch">
          <input
            type="checkbox"
            checked={privacy()}
            onChange={(event) => setPrivacy(event.currentTarget.checked)}
          />
          <span>{t("playlist.create.privacy")}</span>
        </label>

        <Show when={feedback()}>
          {(current) => (
            <div
              class={
                current().tone === "error"
                  ? "create-playlist-feedback status-error"
                  : "create-playlist-feedback status-line"
              }
              role="status"
            >
              {current().message}
            </div>
          )}
        </Show>

        <button
          type="submit"
          class="primary-button create-playlist-submit"
          disabled={!name().trim() || submitting()}
        >
          <IconPlus />
          <span>
            {submitting() ? t("playlist.create.submitting") : t("playlist.create.submit")}
          </span>
        </button>
      </form>
    </Modal>
  );
}
