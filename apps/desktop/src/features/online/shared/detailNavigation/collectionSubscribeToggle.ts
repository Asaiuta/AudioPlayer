import type { Accessor, Setter } from "solid-js";
import type { TranslationKey } from "../../../../shared/i18n";
import type { DetailNavigationBaseContext } from "./types";

interface SubscribeToggleMessages {
  loginRequired: TranslationKey;
  subscribeSuccess: TranslationKey;
  unsubscribeSuccess: TranslationKey;
}

export interface SubscribeToggleOptions<TItem, TDetail, TEvent> {
  ctx: DetailNavigationBaseContext;
  selectedItem: Accessor<TItem | null>;
  selectedId: (item: TItem) => number;
  isToggling: Accessor<boolean>;
  setIsToggling: Setter<boolean>;
  detail: Accessor<TDetail | null>;
  readSubscribed: (detail: TDetail | null, item: TItem) => boolean;
  requestToggle: (id: number, subscribed: boolean) => Promise<unknown>;
  applySubscribed: (item: TItem, subscribed: boolean) => void;
  createEventItem: (item: TItem, detail: TDetail | null) => TEvent;
  onChange?: (item: TEvent, subscribed: boolean) => void;
  messages: SubscribeToggleMessages;
}

export const createSubscribeToggle = <TItem, TDetail, TEvent>(
  options: SubscribeToggleOptions<TItem, TDetail, TEvent>
) => async () => {
  const item = options.selectedItem();
  if (!item || options.isToggling()) return;
  if (options.ctx.loginProfile() === null) {
    options.ctx.setFeedback("error", options.ctx.t(options.messages.loginRequired));
    return;
  }

  const itemId = options.selectedId(item);
  const nextSubscribed = !options.readSubscribed(options.detail(), item);
  options.setIsToggling(true);
  try {
    await options.requestToggle(itemId, nextSubscribed);
    const current = options.selectedItem();
    if (!current || options.selectedId(current) !== itemId) return;
    options.applySubscribed(item, nextSubscribed);
    options.onChange?.(options.createEventItem(item, options.detail()), nextSubscribed);
    options.ctx.setFeedback(
      "success",
      nextSubscribed
        ? options.ctx.t(options.messages.subscribeSuccess)
        : options.ctx.t(options.messages.unsubscribeSuccess)
    );
  } catch (error) {
    const current = options.selectedItem();
    if (current && options.selectedId(current) === itemId) {
      options.ctx.setFeedback("error", options.ctx.readErrorMessage(error));
    }
  } finally {
    const current = options.selectedItem();
    if (current && options.selectedId(current) === itemId) {
      options.setIsToggling(false);
    }
  }
};
