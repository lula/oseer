"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  NavSidebar,
  NavSidebarItems,
} from "./ui/nav-sidebar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { isNavGroup, NAV_SECTIONS } from "@/lib/navigation";
import { type NavItem } from "@/lib/nav-items";

/**
 * Floating sidebar with sections and their pages, minimizing to an icon
 * rail. Rendered on the server: `footer` is the signed-in user, `adminNav`
 * the admin-only sections (empty for others).
 */
export function AppSidebar({
  footer,
  adminNav,
}: {
  footer: ReactNode;
  adminNav?: ReactNode;
}) {
  return (
    <NavSidebar rail linkComponent={Link} header={<Brand />} footer={footer}>
      <NavSections />
      {adminNav}
    </NavSidebar>
  );
}

function Brand() {
  const { isMobile, setOpenMobile } = useSidebar();
  const t = useTranslations("nav");
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          render={
            <Link href="/" onClick={() => isMobile && setOpenMobile(false)} />
          }
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <SparklesIcon className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-medium">Open Seer</span>
            <span className="text-xs text-muted-foreground">
              {t("tagline")}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * The visible sections (`admin`: the admin-only ones), as collapsible
 * groups of pages. A server component can render it: icons can't be
 * passed as props.
 *
 * The URL (for the active page) isn't known when prerendering dynamic
 * routes such as /users/[id], so it's read behind a Suspense boundary; until
 * then the sections show with no active page.
 */
export function NavSections({ admin = false }: { admin?: boolean }) {
  return (
    <Suspense fallback={<Sections admin={admin} pathname={null} />}>
      <ActiveSections admin={admin} />
    </Suspense>
  );
}

function ActiveSections({ admin }: { admin: boolean }) {
  return <Sections admin={admin} pathname={usePathname()} />;
}

function Sections({
  admin,
  pathname,
}: {
  admin: boolean;
  pathname: string | null;
}) {
  const t = useTranslations("nav");
  const items: NavItem[] = NAV_SECTIONS.filter(
    (section) => !section.hidden && !!section.adminOnly === admin,
  ).map((section) => ({
    label: t(section.title),
    icon: section.icon,
    children: section.items.map((entry) =>
      isNavGroup(entry)
        ? {
            label: t(entry.title),
            icon: entry.icon,
            children: entry.items.map((item) => ({
              label: t(item.title),
              url: item.href,
              icon: item.icon,
            })),
          }
        : { label: t(entry.title), url: entry.href, icon: entry.icon },
    ),
  }));
  return <NavSidebarItems items={items} pathname={pathname} />;
}
