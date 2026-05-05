import { createEffect, createSignal, Show } from "solid-js";
import { useTranslation } from "../shared/i18n";

interface CoverArtProps {
  coverUrl: string | null;
  alt?: string;
}

export function CoverArt(props: CoverArtProps) {
  const { t } = useTranslation();
  const [hasFailed, setHasFailed] = createSignal(false);

  createEffect(() => {
    props.coverUrl;
    setHasFailed(false);
  });

  const showImage = () => props.coverUrl !== null && !hasFailed();
  const resolvedAlt = () => props.alt ?? t("cover.alt");

  return (
    <div class="cover-art">
      <Show
        when={showImage()}
        fallback={
          <div class="cover-placeholder" aria-hidden="true">
            <span>♪</span>
          </div>
        }
      >
        <img
          class="cover-art-image"
          src={props.coverUrl ?? ""}
          alt={resolvedAlt()}
          onError={() => setHasFailed(true)}
        />
      </Show>
    </div>
  );
}
