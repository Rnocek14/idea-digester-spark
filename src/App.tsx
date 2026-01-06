import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HostnameRouter from "./components/HostnameRouter";
import LakeGeneva from "./pages/LakeGeneva";
import SellingLakeGeneva from "./pages/SellingLakeGeneva";
import PublicDirectory from "./pages/PublicDirectory";
import Advertise from "./pages/Advertise";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import NotFound from "./pages/NotFound";

// Direct imports for dashboard components (v2)
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
import ImageTest from "./pages/ImageTest";
import EngagementMonitor from "./pages/EngagementMonitor";
import Auth from "./pages/Auth";
import Jobs from "./pages/Jobs";
import PostJob from "./pages/PostJob";
import AdminJobs from "./pages/AdminJobs";
import EmployerDashboard from "./pages/EmployerDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <HostnameRouter>
            <Routes>
            <Route path="/" element={<LakeGeneva />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/lake-geneva" element={<Navigate to="/" replace />} />
            <Route path="/selling-lake-geneva" element={<SellingLakeGeneva />} />
            <Route path="/directory" element={<PublicDirectory />} />
            <Route path="/advertise" element={<Advertise />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:slug" element={<IncidentDetail />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/post" element={<PostJob />} />
            <Route path="/employer-dashboard" element={<EmployerDashboard />} />
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
              <Route path="image-test" element={<ImageTest />} />
              <Route path="engagement" element={<EngagementMonitor />} />
              <Route path="jobs" element={<AdminJobs />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
          </HostnameRouter>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
