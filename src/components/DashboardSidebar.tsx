import { FileText, Radio, Megaphone, LayoutDashboard, Mail, CalendarDays, Building2, BarChart3, Users, Image, Heart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Content Queue", url: "/dashboard/content", icon: FileText },
  { title: "Newsletter", url: "/dashboard/newsletter", icon: Mail },
  { title: "Social Queue", url: "/dashboard/social-queue", icon: CalendarDays },
  { title: "Sources", url: "/dashboard/sources", icon: Radio },
  { title: "Sponsors", url: "/dashboard/sponsors", icon: Megaphone },
  { title: "Leads", url: "/dashboard/leads", icon: Users },
  { title: "Directory", url: "/dashboard/directory", icon: Building2 },
  { title: "Analytics", url: "/dashboard/sponsor-analytics", icon: BarChart3 },
  { title: "Engagement", url: "/dashboard/engagement", icon: Heart },
  { title: "Image Test", url: "/dashboard/image-test", icon: Image },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-6">
          <h2 className={`font-bold text-lg ${isCollapsed ? "hidden" : "block"}`}>
            ALMN Admin
          </h2>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={isCollapsed ? "hidden" : "block"}>
        <div className="px-2 py-2 text-xs text-muted-foreground">Admin</div>
      </SidebarFooter>
    </Sidebar>
  );
}
