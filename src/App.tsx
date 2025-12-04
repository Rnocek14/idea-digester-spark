import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LakeGeneva from "./pages/LakeGeneva";
import SellingLakeGeneva from "./pages/SellingLakeGeneva";
import PublicDirectory from "./pages/PublicDirectory";
import Advertise from "./pages/Advertise";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import NotFound from "./pages/NotFound";

// Lazy load dashboard components to avoid eager ThemeToggle import
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContentQueue = lazy(() => import("./pages/ContentQueue"));
const Sources = lazy(() => import("./pages/Sources"));
const Sponsors = lazy(() => import("./pages/Sponsors"));
const Directory = lazy(() => import("./pages/Directory"));
const Newsletter = lazy(() => import("./pages/Newsletter"));
const SocialQueue = lazy(() => import("./pages/SocialQueue"));
const SponsorAnalytics = lazy(() => import("./pages/SponsorAnalytics"));
const Leads = lazy(() => import("./pages/Leads"));
const ImageTest = lazy(() => import("./pages/ImageTest"));
const EngagementMonitor = lazy(() => import("./pages/EngagementMonitor"));
const Auth = lazy(() => import("./pages/Auth"));

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
          <Routes>
            <Route path="/" element={<LakeGeneva />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/lake-geneva" element={<Navigate to="/" replace />} />
            <Route path="/selling-lake-geneva" element={<SellingLakeGeneva />} />
            <Route path="/directory" element={<PublicDirectory />} />
            <Route path="/advertise" element={<Advertise />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:slug" element={<IncidentDetail />} />
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
