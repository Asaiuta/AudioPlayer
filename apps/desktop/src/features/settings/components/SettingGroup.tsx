import type { JSX } from "solid-js";

interface SettingGroupProps {
  title: string;
  children: JSX.Element;
}

export function SettingGroup(props: SettingGroupProps) {
  return (
    <div class="settings-section-group flex flex-col gap-3 pt-0">
      <h3 class="settings-section-group-title relative m-0 mb-1 flex items-center gap-2 pl-0 text-[22px] font-600 text-text">
        <span class="block h-[calc(1em+2px)] w-1 shrink-0 rounded-xs bg-accent" aria-hidden="true" />
        <span>{props.title}</span>
      </h3>
      {props.children}
    </div>
  );
}
