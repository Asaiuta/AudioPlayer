import { createSignal } from "solid-js";

export function usePlayerBarOverlays() {
  const [volumePopoverOpen, setVolumePopoverOpen] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [qualityOpen, setQualityOpen] = createSignal(false);
  const [controlsOpen, setControlsOpen] = createSignal(false);

  return {
    volumePopoverOpen,
    moreOpen,
    qualityOpen,
    controlsOpen,
    setVolumePopoverOpen,
    setMoreOpen,
    setQualityOpen,
    setControlsOpen,
    closeMore: () => setMoreOpen(false),
    closeQuality: () => setQualityOpen(false)
  };
}
