import { createSignal } from "solid-js";
import { useDismissibleOverlay } from "../../shared/ui/useDismissibleOverlay";

export function usePlayerBarOverlays() {
  const [volumePopoverOpen, setVolumePopoverOpen] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [qualityOpen, setQualityOpen] = createSignal(false);
  const [controlsOpen, setControlsOpen] = createSignal(false);
  let volumeRef: HTMLDivElement | undefined;
  let moreRef: HTMLDivElement | undefined;
  let qualityRef: HTMLDivElement | undefined;
  let controlsRef: HTMLDivElement | undefined;

  useDismissibleOverlay(volumePopoverOpen, {
    isInside: (target) => !!volumeRef && volumeRef.contains(target),
    onDismiss: () => setVolumePopoverOpen(false)
  });

  useDismissibleOverlay(moreOpen, {
    isInside: (target) => !!moreRef && moreRef.contains(target),
    onDismiss: () => setMoreOpen(false)
  });

  useDismissibleOverlay(qualityOpen, {
    isInside: (target) => !!qualityRef && qualityRef.contains(target),
    onDismiss: () => setQualityOpen(false)
  });

  useDismissibleOverlay(controlsOpen, {
    isInside: (target) => !!controlsRef && controlsRef.contains(target),
    onDismiss: () => setControlsOpen(false)
  });

  return {
    volumePopoverOpen,
    moreOpen,
    qualityOpen,
    controlsOpen,
    toggleVolumePopover: () => setVolumePopoverOpen((open) => !open),
    toggleMore: () => setMoreOpen((open) => !open),
    toggleQuality: () => setQualityOpen((open) => !open),
    toggleControls: () => setControlsOpen((open) => !open),
    closeVolumePopover: () => setVolumePopoverOpen(false),
    closeMore: () => setMoreOpen(false),
    closeQuality: () => setQualityOpen(false),
    closeControls: () => setControlsOpen(false),
    setVolumeRef: (element: HTMLDivElement) => {
      volumeRef = element;
    },
    setMoreRef: (element: HTMLDivElement) => {
      moreRef = element;
    },
    setQualityRef: (element: HTMLDivElement) => {
      qualityRef = element;
    },
    setControlsRef: (element: HTMLDivElement) => {
      controlsRef = element;
    }
  };
}
