import { type MessageKeys, type Messages, type NestedKeyOf } from "next-intl";
import {
  DatabaseZapIcon,
  Grid2X2PlusIcon,
  HouseIcon,
  ImportIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  TablePropertiesIcon,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * A title: a key of the `nav` messages, translated where it's shown.
 * Nested messages use dotted paths (`customers.list`).
 */
export type NavTitle = MessageKeys<
  Messages["nav"],
  NestedKeyOf<Messages["nav"]>
>;

export interface NavItem {
  title: NavTitle;
  href: string;
  /** Shown when the sidebar is minimized to a rail. */
  icon: LucideIcon;
}

/** A group of pages inside a section (the sidebar's third level). */
export interface NavGroup {
  title: NavTitle;
  /** Shown for the group when the sidebar is minimized to a rail. */
  icon?: LucideIcon;
  items: NavItem[];
}

export interface NavSection {
  title: NavTitle;
  /** Where the section title links to (usually its first page). */
  href: string;
  items: (NavItem | NavGroup)[];
  /** Shown for the section when the sidebar is minimized to a rail. */
  icon?: LucideIcon;
  /** Only shown to users with the `admin` role. */
  adminOnly?: boolean;
  /** Only used to show breadcrumb. */
  hidden?: boolean;
}

/** Sidebar navigation: sections with their pages. */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "home",
    href: "/",
    icon: HouseIcon,
    items: [{ title: "dashboard", href: "/", icon: LayoutDashboardIcon }],
  },
  {
    title: 'tableDesigner.title',
    href: ".",
    icon: DatabaseZapIcon,
    items: [
      { title: 'tableDesigner.design', href: "/table-designer/design", icon: Grid2X2PlusIcon },
      { title: 'tableDesigner.tables', href: "/table-designer/tables", icon: TablePropertiesIcon },
      { title: 'tableDesigner.import', href: "/table-designer/import", icon: ImportIcon },
    ],
    adminOnly: true
  }
];

export function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return "items" in item;
}

/** Whether a path is the url or below it. "/" only matches itself. */
function matches(url: string, pathname: string) {
  if (url === "/") {
    return pathname === "/";
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * The section, group (if the page is in one) and page for a path: the most
 * specific match ("/table-designer/tables" picks that page over
 * "/table-designer"; "/account/x" matches "/account").
 */
export function findNavItem(
  pathname: string,
): { section: NavSection; group?: NavGroup; item: NavItem } | undefined {
  let best: { section: NavSection; group?: NavGroup; item: NavItem } | undefined;
  const consider = (section: NavSection, item: NavItem, group?: NavGroup) => {
    if (matches(item.href, pathname) && (!best || item.href.length > best.item.href.length)) {
      best = { section, group, item };
    }
  };
  for (const section of NAV_SECTIONS) {
    for (const entry of section.items) {
      if (isNavGroup(entry)) {
        for (const item of entry.items) consider(section, item, entry);
      } else {
        consider(section, entry);
      }
    }
  }
  return best;
}

/*
 * The sidebar tree drawn by `ui/nav-sidebar.tsx`: NAV_SECTIONS with the
 * titles already translated (see `components/app-sidebar.tsx`).
 */

/** An icon component (e.g. from lucide-react). */
export type NavTreeIcon = ComponentType<{ className?: string }>;

/** A page: always has a url. */
export interface NavTreeLeaf {
  label: string;
  url: string;
  icon?: NavTreeIcon;
  children?: never;
}

/** A collapsible group; its url, if any, makes the label a link. */
export interface NavTreeGroup<Child> {
  label: string;
  url?: string;
  icon?: NavTreeIcon;
  /** Open on first render (default true). Always opens on the active page. */
  defaultOpen?: boolean;
  children: Child[];
}

type NavTreeLevel3 = NavTreeLeaf;
type NavTreeLevel2 = NavTreeLeaf | NavTreeGroup<NavTreeLevel3>;
/** A sidebar item: at most 3 levels (group → group → leaf). */
export type NavTreeItem = NavTreeLeaf | NavTreeGroup<NavTreeLevel2>;

/** Any node of the tree, whatever its level. */
export type NavTreeNode = NavTreeLeaf | NavTreeGroup<NavTreeNode>;

export function isNavTreeGroup(item: NavTreeNode): item is NavTreeGroup<NavTreeNode> {
  return Array.isArray(item.children);
}

function* urls(items: readonly NavTreeNode[]): Generator<string> {
  for (const item of items) {
    if (item.url) {
      yield item.url;
    }
    if (isNavTreeGroup(item)) {
      yield* urls(item.children);
    }
  }
}

/**
 * The url of the active item for a path: the most specific match
 * ("/admin/users/1" picks "/admin/users" over "/admin"). "/" only matches
 * itself.
 */
export function findActiveUrl(
  items: readonly NavTreeNode[],
  pathname: string | null | undefined,
): string | undefined {
  if (!pathname) {
    return undefined;
  }
  let best: string | undefined;
  for (const url of urls(items)) {
    if (matches(url, pathname) && (!best || url.length > best.length)) {
      best = url;
    }
  }
  return best;
}

/** Whether a group's descendants (not the group itself) include the url. */
export function containsUrl(
  group: NavTreeGroup<NavTreeNode>,
  url: string | undefined,
): boolean {
  if (!url) {
    return false;
  }
  for (const child of group.children) {
    if (child.url === url) {
      return true;
    }
    if (isNavTreeGroup(child) && containsUrl(child, url)) {
      return true;
    }
  }
  return false;
}
