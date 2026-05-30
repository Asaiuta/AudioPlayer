import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

export type OnlineDetailViewReporter = (hasDetailView: boolean) => void;

export interface OnlineDetailViewReporterProps {
  onDetailViewChange?: OnlineDetailViewReporter;
}

export function createDetailViewReporter(
  hasDetailView: Accessor<boolean>,
  report: OnlineDetailViewReporter | undefined
) {
  createEffect(() => {
    report?.(hasDetailView());
  });

  onCleanup(() => {
    report?.(false);
  });
}
