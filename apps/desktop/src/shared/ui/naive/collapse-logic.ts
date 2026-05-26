export type NaiveCollapseName = string | number;

export type NaiveCollapseExpandedNamesInput =
  | readonly NaiveCollapseName[]
  | NaiveCollapseName
  | null
  | undefined;

export interface NaiveCollapseHeaderClickInfo {
  readonly name: string;
  readonly expanded: boolean;
}

export type NaiveCollapseTransitionPhase =
  | "entered"
  | "entering"
  | "exiting"
  | "exited";

export interface NaiveCollapseTransitionSnapshot {
  readonly phase: NaiveCollapseTransitionPhase;
  readonly visible: boolean;
  readonly maxHeight: string;
}

export const naiveCollapseNameKey = (name: NaiveCollapseName): string =>
  String(name);

export const normalizeNaiveCollapseNames = (
  value: NaiveCollapseExpandedNamesInput
): string[] => {
  if (value == null) return [];
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((item) => {
    const key = naiveCollapseNameKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(key);
  });
  return result;
};

export const resolveNaiveCollapseHeaderClick = (
  previousNames: readonly string[],
  nextNames: readonly string[]
): NaiveCollapseHeaderClickInfo | null => {
  const previous = new Set(previousNames);
  const next = new Set(nextNames);
  const expandedName = nextNames.find((name) => !previous.has(name));
  if (expandedName !== undefined) return { name: expandedName, expanded: true };

  const collapsedName = previousNames.find((name) => !next.has(name));
  if (collapsedName !== undefined) return { name: collapsedName, expanded: false };

  return null;
};

export const createCollapseTransitionSnapshot = (
  phase: NaiveCollapseTransitionPhase,
  measuredHeight: number
): NaiveCollapseTransitionSnapshot => {
  if (phase === "entered") {
    return { phase, visible: true, maxHeight: "" };
  }
  if (phase === "exited") {
    return { phase, visible: false, maxHeight: "0px" };
  }
  return {
    phase,
    visible: true,
    maxHeight: `${Math.max(0, measuredHeight)}px`
  };
};
