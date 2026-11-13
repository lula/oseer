import "../../globals.css";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CSSProperties, Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { NavUser } from "@/components/nav-user";
import { requireUser } from "@/lib/session";

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "19rem" } as CSSProperties}>
      <AppSidebar
        // adminNav={
        //   <Suspense fallback={null}>
        //     <AdminNav />
        //   </Suspense>
        // }
        footer={
          //The session is read per request, so the user streams in behind a boundary.
          <Suspense fallback={<UserSkeleton />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset>
        {/* Pages name their level of the breadcrumb (<BreadcrumbLabel>). */}

        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </header>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Not SidebarMenuSkeleton: its random width breaks prerendering.
function UserSkeleton() {
  return (
    <div className="flex h-12 items-center gap-2 p-2 group-data-[collapsible=icon]:p-0">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

async function SidebarUser() {
  const { name, email, image } = await requireUser();
  return <NavUser user={{ name, email, image }} />;
}
