import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, LayoutDashboard, PlusCircle, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const items = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Campanhas", url: "/campaigns", icon: BarChart3 },
  { title: "Nova Campanha", url: "/campaigns/new", icon: PlusCircle },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[image:var(--gradient-primary)] glow-ring">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold tracking-tight">
              PubGrowth <span className="text-gradient">AI</span>
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              Relatórios executivos
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.exact
                  ? pathname === item.url
                  : pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className={cn("flex items-center gap-2")}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2 text-[11px] text-muted-foreground">
          MVP · dados manuais
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
