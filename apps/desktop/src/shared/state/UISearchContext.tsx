import { createContext, createSignal, useContext } from "solid-js";
import type { Accessor, JSX, Setter } from "solid-js";

export type ActivePage =
  | "recommend"
  | "discover"
  | "library"
  | "liked"
  | "cloud"
  | "recent"
  | "queue"
  | "created-playlists"
  | "collected-playlists"
  | "settings";

interface UISearchContextValue {
  query: Accessor<string>;
  setQuery: Setter<string>;
  activePage: Accessor<ActivePage>;
}

const UISearchContext = createContext<UISearchContextValue | null>(null);

type MaybeAccessor<T> = T | Accessor<T>;

interface UISearchProviderProps {
  activePage: MaybeAccessor<ActivePage>;
  children: JSX.Element;
}

const toAccessor = <T,>(value: MaybeAccessor<T>): Accessor<T> =>
  typeof value === "function" ? (value as Accessor<T>) : () => value;

/**
 * Lifts the TopNav search query into a small global. Scoped to the Library
 * Songs tab in PR3 — `activePage` is forwarded so consumers can decide whether
 * to consume the query or render a "search disabled" hint.
 */
export function UISearchProvider(props: UISearchProviderProps) {
  const [query, setQuery] = createSignal("");
  const activePage = toAccessor(props.activePage);

  return (
    <UISearchContext.Provider value={{ query, setQuery, activePage }}>
      {props.children}
    </UISearchContext.Provider>
  );
}

export function useUISearch(): UISearchContextValue {
  const ctx = useContext(UISearchContext);
  if (!ctx) {
    throw new Error("useUISearch must be used within UISearchProvider");
  }
  return ctx;
}
