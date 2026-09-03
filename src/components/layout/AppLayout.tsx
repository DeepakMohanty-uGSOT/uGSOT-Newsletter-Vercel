import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout } from "@/lib/api-client";
import { LayoutDashboard, Users, Mail, Settings, LogOut, FileText, GraduationCap, Loader2, ShieldCheck, Palette, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const baseMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
  { title: "Employees", icon: Users, url: "/employees" },
  { title: "Newsletters", icon: FileText, url: "/newsletters" },
  { title: "Email Logs", icon: Mail, url: "/email-logs" },
  { title: "Settings", icon: Settings, url: "/settings" },
];

const superAdminMenuItems = [
  { title: "Themes", icon: Palette, url: "/themes" },
  { title: "Users", icon: ShieldCheck, url: "/users" },
  { title: "Audit Log", icon: History, url: "/audit-log" },
];

function AppSidebar({ role }: { role?: "super_admin" | "admin" }) {
  const [location, setLocation] = useLocation();
  const menuItems = role === "super_admin" ? [...baseMenuItems, ...superAdminMenuItems] : baseMenuItems;
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        // Overwrite the cached session immediately rather than just
        // invalidating it: invalidateQueries only *schedules* a refetch, and
        // while that request is in flight (or if it fails, which the now-401
        // /auth/me response does right after logout) React Query keeps
        // serving the last successful — still logged-in — session data. That
        // left AppLayout's effect never seeing loggedIn:false, so the
        // redirect only happened after a manual refresh wiped the cache.
        queryClient.setQueryData(getGetMeQueryKey(), { email: "", loggedIn: false });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      }
    });
  };

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center border-b px-4">
        <div className="flex items-center gap-2.5 font-semibold text-base">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-foreground">Newsletter Central</span>
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">upGrad SOT</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url || (item.url !== "/dashboard" && location.startsWith(item.url))}>
                    <Link href={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout} disabled={logoutMutation.isPending}>
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading, isError } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!session || !session.loggedIn) {
      if (location !== "/login") {
        setLocation("/login");
      }
      return;
    }
    if (session.mustChangePassword && location !== "/change-password") {
      setLocation("/change-password");
    }
  }, [isLoading, session, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !session.loggedIn) {
    return null; // Will redirect
  }

  if (session.mustChangePassword) {
    return null; // Will redirect to /change-password
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar role={session.role} />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center border-b border-sidebar-border bg-sidebar px-4 lg:px-8 gap-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="ml-auto hidden sm:flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold uppercase">
                {session.email?.[0] ?? "A"}
              </div>
              <span className="font-medium text-sm text-foreground/80">{session.email}</span>
            </div>
          </header>
          <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}