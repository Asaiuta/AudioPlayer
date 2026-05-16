import type { LibrarySortField, LibrarySortOrder, LibrarySortState } from "./libraryViewTypes";

const DEFAULT_SORT: LibrarySortState = { field: "default", order: "default" };
const NUMERIC_SORT_FIELDS: readonly LibrarySortField[] = [
  "duration",
  "size",
  "createTime",
  "updatedTime"
];

export const nextSortForField = (
  current: LibrarySortState,
  field: LibrarySortField
): LibrarySortState => {
  if (field === "default") {
    return DEFAULT_SORT;
  }
  if (current.field === field) {
    return {
      field,
      order: current.order === "asc" ? "desc" : "asc"
    };
  }
  return {
    field,
    order: NUMERIC_SORT_FIELDS.includes(field) ? "desc" : "asc"
  };
};

export const nextSortForOrder = (
  current: LibrarySortState,
  order: LibrarySortOrder
): LibrarySortState => {
  if (order === "default") {
    return DEFAULT_SORT;
  }
  if (current.field === "default") {
    return { field: "title", order };
  }
  return { ...current, order };
};
