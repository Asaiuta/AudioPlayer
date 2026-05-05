import { Show } from "solid-js";
import type { JSX } from "solid-js";

interface PageHeaderProps {
  title: string;
  meta?: JSX.Element;
  actions?: JSX.Element;
  tabs?: JSX.Element;
}

/**
 * PageHeader - large title + meta line up top, action row left + tabs right.
 * Reused by Library and queue/history-style pages.
 */
export function PageHeader(props: PageHeaderProps) {
  return (
    <header class="page-header">
      <div class="page-header-top">
        <h1 class="page-header-title">{props.title}</h1>
        <Show when={props.meta}>
          {(meta) => <div class="page-header-meta">{meta()}</div>}
        </Show>
      </div>
      <Show when={props.actions || props.tabs}>
        <div class="page-header-row">
          <Show when={props.actions}>
            {(actions) => <div class="page-header-actions">{actions()}</div>}
          </Show>
          <Show when={props.tabs}>
            {(tabs) => <div class="page-header-tabs">{tabs()}</div>}
          </Show>
        </div>
      </Show>
    </header>
  );
}
