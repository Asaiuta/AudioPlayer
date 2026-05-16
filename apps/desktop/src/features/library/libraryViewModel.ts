import type { LibraryFolderSummary } from "../../shared/api/types";
import type { LibraryFolderNode, LibraryGroup, LibraryListItem, LibrarySortState } from "./libraryViewTypes";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export const matchesSearch = (item: LibraryListItem, query: string) => {
  if (!query) return true;
  const haystacks = [item.title, item.artist, item.album, item.source_path];
  return haystacks.some((value) => value?.toLowerCase().includes(query));
};

export const fallbackLabel = (value: string | null, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export const normalizeLibraryPath = (path: string) =>
  path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "")
    .replace(/\\/g, "/");

export const folderPathFromSource = (sourcePath: string) => {
  const normalized = normalizeLibraryPath(sourcePath).replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
};

export const folderNameFromPath = (path: string) => {
  const normalized = normalizeLibraryPath(path).replace(/\/+$/, "");
  return normalized.split("/").filter(Boolean).pop() ?? path;
};

export const pathContainsFolder = (parentFolder: string, childFolder: string) => {
  const parent = normalizeLibraryPath(parentFolder).replace(/\/+$/, "");
  const child = normalizeLibraryPath(childFolder).replace(/\/+$/, "");
  return child === parent || child.startsWith(`${parent}/`);
};

const compareText = (left: string | null | undefined, right: string | null | undefined) =>
  collator.compare(left?.trim() ?? "", right?.trim() ?? "");

export const sortItems = (
  items: readonly LibraryListItem[],
  sort: LibrarySortState
): LibraryListItem[] => {
  if (sort.field === "default" || sort.order === "default") {
    return [...items];
  }

  const factor = sort.order === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    let result = 0;
    switch (sort.field) {
      case "title":
        result = compareText(
          left.title ?? folderNameFromPath(left.source_path ?? left.id),
          right.title ?? folderNameFromPath(right.source_path ?? right.id)
        );
        break;
      case "album":
        result = compareText(left.album, right.album);
        break;
      case "artist":
        result = compareText(left.artist, right.artist);
        break;
      case "trackNumber":
        result = (left.track_number ?? 0) - (right.track_number ?? 0);
        break;
      case "filename":
        result = compareText(
          left.fileName ?? folderNameFromPath(left.source_path ?? left.id),
          right.fileName ?? folderNameFromPath(right.source_path ?? right.id)
        );
        break;
      case "duration":
        result = (left.duration_secs ?? 0) - (right.duration_secs ?? 0);
        break;
      case "size":
        result = (left.size_bytes ?? 0) - (right.size_bytes ?? 0);
        break;
      case "createTime":
        result = (left.added_at_epoch_secs ?? 0) - (right.added_at_epoch_secs ?? 0);
        break;
      case "updatedTime":
        result = (left.updated_at_epoch_secs ?? 0) - (right.updated_at_epoch_secs ?? 0);
        break;
      case "default":
        result = 0;
        break;
      default: {
        const _exhaustive: never = sort.field;
        throw new Error(`Unhandled library sort field: ${_exhaustive}`);
      }
    }
    return result * factor;
  });
};

interface MutableFolderNode {
  key: string;
  label: string;
  directCount: number;
  totalCount: number;
  depth: number;
  children: Map<string, MutableFolderNode>;
}

const toFolderNode = (node: MutableFolderNode): LibraryFolderNode => ({
  key: node.key,
  label: node.label,
  directCount: node.directCount,
  totalCount: node.totalCount,
  depth: node.depth,
  children: [...node.children.values()]
    .sort((left, right) => collator.compare(left.label, right.label))
    .map(toFolderNode)
});

const compactFolderNode = (node: LibraryFolderNode, depth: number): LibraryFolderNode => {
  let current = node;
  let label = node.label;

  while (current.children.length === 1 && current.directCount === 0) {
    const child = current.children[0];
    const separator = child.key.includes("\\") ? "\\" : "/";
    label = `${label}${separator}${child.label}`;
    current = child;
  }

  return {
    key: current.key,
    label,
    directCount: current.directCount,
    totalCount: node.totalCount,
    depth,
    children: current.children.map((child) => compactFolderNode(child, depth + 1))
  };
};

export const buildFolderTree = (items: readonly LibraryListItem[]): LibraryFolderNode[] => {
  const roots = new Map<string, MutableFolderNode>();
  const nodeByPath = new Map<string, MutableFolderNode>();

  const ensureNode = (key: string, label: string, depth: number, parent?: MutableFolderNode) => {
    const existing = nodeByPath.get(key);
    if (existing) return existing;
    const node: MutableFolderNode = {
      key,
      label,
      directCount: 0,
      totalCount: 0,
      depth,
      children: new Map<string, MutableFolderNode>()
    };
    nodeByPath.set(key, node);
    if (parent) {
      parent.children.set(key, node);
    } else {
      roots.set(key, node);
    }
    return node;
  };

  items.forEach((item) => {
    const folderPath = folderPathFromSource(item.source_path ?? item.id);
    const normalized = normalizeLibraryPath(folderPath).replace(/\/+$/, "");
    const prefix = normalized.startsWith("/") ? "/" : "";
    const segments = normalized.split("/").filter(Boolean);
    let parent: MutableFolderNode | undefined;
    let currentPath = prefix;

    segments.forEach((segment, index) => {
      currentPath =
        currentPath === "/" || currentPath === ""
          ? `${currentPath}${segment}`
          : `${currentPath}/${segment}`;
      parent = ensureNode(currentPath, segment, index, parent);
      parent.totalCount += 1;
      if (index === segments.length - 1) {
        parent.directCount += 1;
      }
    });
  });

  return [...roots.values()]
    .sort((left, right) => collator.compare(left.label, right.label))
    .map(toFolderNode)
    .map((node) => compactFolderNode(node, 0));
};

export const buildFolderTreeFromFolders = (
  folders: readonly LibraryFolderSummary[]
): LibraryFolderNode[] => {
  const roots = new Map<string, MutableFolderNode>();
  const nodeByPath = new Map<string, MutableFolderNode>();

  const ensureNode = (
    key: string,
    label: string,
    depth: number,
    parent?: MutableFolderNode
  ) => {
    const existing = nodeByPath.get(key);
    if (existing) return existing;
    const node: MutableFolderNode = {
      key,
      label,
      directCount: 0,
      totalCount: 0,
      depth,
      children: new Map<string, MutableFolderNode>()
    };
    nodeByPath.set(key, node);
    if (parent) {
      parent.children.set(key, node);
    } else {
      roots.set(key, node);
    }
    return node;
  };

  folders.forEach((folder) => {
    const normalized = normalizeLibraryPath(folder.path).replace(/\/+$/, "");
    const prefix = normalized.startsWith("/") ? "/" : "";
    const segments = normalized.split("/").filter(Boolean);
    let parent: MutableFolderNode | undefined;
    let currentPath = prefix;

    segments.forEach((segment, index) => {
      currentPath =
        currentPath === "/" || currentPath === ""
          ? `${currentPath}${segment}`
          : `${currentPath}/${segment}`;
      parent = ensureNode(currentPath, segment, index, parent);
      parent.totalCount += folder.count;
      if (index === segments.length - 1) {
        parent.directCount += folder.count;
      }
    });
  });

  return [...roots.values()]
    .sort((left, right) => collator.compare(left.label, right.label))
    .map(toFolderNode)
    .map((node) => compactFolderNode(node, 0));
};

export const splitArtists = (artist: string | null, fallback: string) =>
  fallbackLabel(artist, fallback)
    .split(/[/、，,;&]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const groupByKey = (
  items: LibraryListItem[],
  keyForItem: (item: LibraryListItem) => string[],
  detailForGroup?: (key: string, songs: LibraryListItem[]) => string | undefined
): LibraryGroup[] => {
  const groups = items.reduce<Map<string, LibraryListItem[]>>((map, item) => {
    keyForItem(item).forEach((key) => {
      const current = map.get(key) ?? [];
      if (!current.some((existing) => existing.media_id === item.media_id)) {
        map.set(key, [...current, item]);
      }
    });
    return map;
  }, new Map<string, LibraryListItem[]>());

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, songs]) => ({
      key,
      label: key,
      songs,
      artworkUrl: songs.find((song) => song.artworkUrl)?.artworkUrl ?? null,
      detail: detailForGroup?.(key, songs)
    }));
};
