import type { JSX } from "solid-js";

interface ContentAreaProps {
  children: JSX.Element;
}

export function ContentArea(props: ContentAreaProps) {
  return <main class="content-area">{props.children}</main>;
}
