import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { OperationsProvider } from "@/contexts/OperationsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { LogOut, User, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        // Refresh session first to ensure valid token
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.log("[DashboardLayout] No valid session, redirecting to auth");
          navigate("/auth", { replace: true });
          return;
        }

        const session = refreshData.session;
        setUser(session.user);

        // Check if user has admin role
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);

        if (rolesError) {
          console.error("[DashboardLayout] Error checking roles:", rolesError);
          toast.error("Error checking permissions");
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const hasAdminRole = roles?.some((r) => r.role === "admin");
        setIsAdmin(hasAdminRole || false);
        setLoading(false);

        if (!hasAdminRole) {
          toast.error("Access denied. Admin role required.");
        }
      } catch (error) {
        console.error("[DashboardLayout] Auth check error:", error);
        navigate("/auth", { replace: true });
      }
    };

    checkAuthAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/auth", { replace: true });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUser(session.user);
        // Defer role check to avoid deadlock
        setTimeout(async () => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id);

          const hasAdminRole = roles?.some((r) => r.role === "admin");
          setIsAdmin(hasAdminRole || false);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access the admin dashboard. Admin role is required.
          </AlertDescription>
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <OperationsProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-16 border-b bg-background flex items-center justify-between px-6">
                <SidebarTrigger />
                <div className="flex items-center gap-4">
                  {user ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4" />
                        <span className="text-muted-foreground">{user.email}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleSignOut}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </Button>
                    </>
                  ) : null}
                </div>
              </header>
              <main className="flex-1 p-6 bg-muted/20">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </OperationsProvider>
    </ThemeProvider>
  );
};

export default DashboardLayout;