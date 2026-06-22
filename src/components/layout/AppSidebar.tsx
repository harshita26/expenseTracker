import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Receipt, Upload, Tags, Sparkles, BarChart3, Settings, Shield, Wallet, Wand2,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/import", label: "Import Center", icon: Upload },
  { to: "/rules", label: "Auto-Rules", icon: Wand2 },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/cashback", label: "Cashback & Interest", icon: Sparkles },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cashback text-primary-foreground shadow-lg">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">My Money</div>
            <div className="text-xs text-muted-foreground">Private finance OS</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
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
        <div className="m-2 rounded-xl border border-border/60 bg-card/60 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-savings" />
            100% Private & Secure
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your data stays on your device unless you choose to export or sync it.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
