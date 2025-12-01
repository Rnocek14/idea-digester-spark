import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import LakeGeneva from "./pages/LakeGeneva";
import PublicDirectory from "./pages/PublicDirectory";
import Advertise from "./pages/Advertise";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ContentQueue from "./pages/ContentQueue";
import Sources from "./pages/Sources";
import Sponsors from "./pages/Sponsors";
import Directory from "./pages/Directory";
import Newsletter from "./pages/Newsletter";
import SocialQueue from "./pages/SocialQueue";
import SponsorAnalytics from "./pages/SponsorAnalytics";
import Leads from "./pages/Leads";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - data stays fresh longer
      gcTime: 300000, // 5 minutes - keep in cache
      retry: 2, // Retry failed requests twice
      refetchOnWindowFocus: false, // Prevent refetch storms when switching tabs
      refetchOnReconnect: true, // Refetch when reconnecting to network
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/lake-geneva" element={<LakeGeneva />} />
          <Route path="/directory" element={<PublicDirectory />} />
          <Route path="/advertise" element={<Advertise />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="content" element={<ContentQueue />} />
            <Route path="sources" element={<Sources />} />
            <Route path="sponsors" element={<Sponsors />} />
            <Route path="directory" element={<Directory />} />
            <Route path="leads" element={<Leads />} />
            <Route path="newsletter" element={<Newsletter />} />
            <Route path="social-queue" element={<SocialQueue />} />
            <Route path="sponsor-analytics" element={<SponsorAnalytics />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
