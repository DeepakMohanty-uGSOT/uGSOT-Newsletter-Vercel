import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout } from "@/lib/api-client";
import { LayoutDashboard, Users, Mail, Settings, LogOut, FileText, GraduationCap, Loader2 } from "lucide-react";
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

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
  { title: "Employees", icon: Users, url: "/employees" },
  { title: "Newsletters", icon: FileText, url: "/newsletters" },
  { title: "Email Logs", icon: Mail, url: "/email-logs" },
  { title: "Settings", icon: Settings, url: "/settings" },
];

function AppSidebar() {
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        // The AppLayout will redirect
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
            <span className="text-foreground">upGrad SOT</span>
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">Admin Console</span>
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
    if (!isLoading && (!session || !session.loggedIn)) {
      if (location !== "/login") {
        setLocation("/login");
      }
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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center border-b bg-background px-4 lg:px-8 gap-4 sticky top-0 z-10">
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