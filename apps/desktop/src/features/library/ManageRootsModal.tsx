import { For, Show, createSignal } from "solid-js";
import type { LibraryRoot } from "../../shared/api/types";
import { useTranslation } from "../../shared/i18n";
import { Modal } from "../../components/Modal";

export interface ManageRootsModalProps {
  open: boolean;
  onClose: () => void;
  roots: LibraryRoot[];
  isScanning: boolean;
  onAddRoot: (path: string, displayName: string) => Promise<void>;
  onRescan: (root: LibraryRoot) => Promise<void>;
  formatScanTimestamp: (epochSecs: number | null) => string;
}

export function ManageRootsModal(props: ManageRootsModalProps) {
  const { t } = useTranslation();
  const [scanPath, setScanPath] = createSignal("");
  const [scanDisplayName, setScanDisplayName] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const handleAdd = async () => {
    const path = scanPath().trim();
    if (!path) return;
    setSubmitting(true);
    try {
      await props.onAddRoot(path, scanDisplayName().trim());
      setScanPath("");
      setScanDisplayName("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={t("library.modal.manageRoots.title")}
      closeAriaLabel={t("library.modal.manageRoots.close")}
      onClose={props.onClose}
      size="lg"
    >
      <div class="settings-group">
        <span class="field-label">{t("library.roots.title")}</span>
        <Show when={props.roots.length > 0} fallback={<div class="status-line">{t("library.roots.empty")}</div>}>
          <ul class="library-roots">
            <For each={props.roots}>
              {(root) => (
                <li class="library-root">
                  <div class="library-root-meta">
                    <span class="library-root-name">{root.display_name}</span>
                    <span class="library-root-path" title={root.source_path}>{root.source_path}</span>
                    <span class="library-root-stats">
                      {t("library.root.info", {
                        count: root.track_count,
                        kind: root.source_kind,
                        when: props.formatScanTimestamp(root.last_scan_finished_at_epoch_secs),
                        status: root.scan_status
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    class="ghost-button"
                    onClick={() => void props.onRescan(root)}
                    disabled={props.isScanning || submitting()}
                  >
                    {t("library.root.rescan")}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <div class="settings-group">
        <span class="field-label">{t("library.add.title")}</span>
        <div class="settings-grid">
          <input
            class="text-input"
            type="text"
            value={scanPath()}
            onInput={(event) => setScanPath(event.currentTarget.value)}
            placeholder={t("library.add.pathPlaceholder")}
          />
          <input
            class="text-input"
            type="text"
            value={scanDisplayName()}
            onInput={(event) => setScanDisplayName(event.currentTarget.value)}
            placeholder={t("library.add.namePlaceholder")}
          />
        </div>
        <div class="button-row">
          <button
            class="primary-button"
            type="button"
            onClick={() => void handleAdd()}
            disabled={props.isScanning || submitting() || !scanPath().trim()}
          >
            {t("library.add.scan")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
