import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HostnameRouter from "./components/HostnameRouter";
import LakeGeneva from "./pages/LakeGeneva";
import LakeGenevaV2 from "./pages/LakeGenevaV2";
import LakeGenevaNightlife from "./pages/LakeGenevaNightlife";
import LakeGenevaEats from "./pages/LakeGenevaEats";
import FishFryGuide from "./pages/FishFryGuide";
import SellingLakeGeneva from "./pages/SellingLakeGeneva";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
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
import Deals from "./pages/Deals";
import AdminDeals from "./pages/AdminDeals";
import SponsorPortal from "./pages/SponsorPortal";
import BusinessCoverage from "./pages/BusinessCoverage";
import SourceHealth from "./pages/SourceHealth";
import PipelineHealth from "./pages/PipelineHealth";
import Submit from "./pages/Submit";
import CommunityLocalLove from "./pages/CommunityLocalLove";
import CommunityVoices from "./pages/CommunityVoices";
import ThingsToDoLakeGeneva from "./pages/guides/ThingsToDoLakeGeneva";
import MovingToLakeGeneva from "./pages/guides/MovingToLakeGeneva";
import LakeGenevaNeighborhoods from "./pages/guides/LakeGenevaNeighborhoods";
import ThisWeekendLakeGeneva from "./pages/guides/ThisWeekendLakeGeneva";
import WinterLakeGeneva from "./pages/guides/WinterLakeGeneva";
import SummerLakeGeneva from "./pages/guides/SummerLakeGeneva";
import LakeGenevaWithKids from "./pages/guides/LakeGenevaWithKids";
import LakeGenevaSchools from "./pages/guides/LakeGenevaSchools";
import LakeGenevaMarketReport from "./pages/guides/LakeGenevaMarketReport";
import CostOfLivingLakeGeneva from "./pages/guides/CostOfLivingLakeGeneva";
import LakeGenevaVsWilliamsBay from "./pages/guides/LakeGenevaVsWilliamsBay";
import FontanaVsLakeGeneva from "./pages/guides/FontanaVsLakeGeneva";
import WhyPeopleLoveLakeGeneva from "./pages/guides/WhyPeopleLoveLakeGeneva";
import RestaurantsLakeGeneva from "./pages/best-of/RestaurantsLakeGeneva";
import LakeGenevaShorePath from "./pages/guides/LakeGenevaShorePath";
import StreblowBoats from "./pages/guides/StreblowBoats";
import LakeGenevaPublicAccess from "./pages/guides/LakeGenevaPublicAccess";
import LakeGenevaFAQ from "./pages/guides/LakeGenevaFAQ";
import Today from "./pages/Today";
import StoryDetail from "./pages/StoryDetail";

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
            <Route path="/" element={<LakeGenevaV2 />} />
            <Route path="/v1" element={<LakeGeneva />} />
            <Route path="/v2" element={<Navigate to="/" replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/stories/:idOrSlug" element={<StoryDetail />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/lake-geneva" element={<Navigate to="/" replace />} />
            <Route path="/selling-lake-geneva" element={<SellingLakeGeneva />} />
            <Route path="/directory" element={<PublicDirectory />} />
            <Route path="/advertise" element={<Advertise />} />
<Route path="/nightlife" element={<LakeGenevaNightlife />} />
            <Route path="/eats" element={<LakeGenevaEats />} />
            <Route path="/eats/fish-fry" element={<FishFryGuide />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:slug" element={<IncidentDetail />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/post" element={<PostJob />} />
            <Route path="/employer-dashboard" element={<EmployerDashboard />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/sponsor-portal" element={<SponsorPortal />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/community/local-love" element={<CommunityLocalLove />} />
            <Route path="/community/voices" element={<CommunityVoices />} />
            <Route path="/guides/things-to-do-lake-geneva" element={<ThingsToDoLakeGeneva />} />
            <Route path="/guides/moving-to-lake-geneva" element={<MovingToLakeGeneva />} />
            <Route path="/guides/lake-geneva-neighborhoods" element={<LakeGenevaNeighborhoods />} />
            <Route path="/guides/things-to-do-lake-geneva-this-weekend" element={<ThisWeekendLakeGeneva />} />
            <Route path="/guides/things-to-do-lake-geneva-in-winter" element={<WinterLakeGeneva />} />
            <Route path="/guides/best-things-to-do-lake-geneva-in-summer" element={<SummerLakeGeneva />} />
            <Route path="/guides/things-to-do-lake-geneva-with-kids" element={<LakeGenevaWithKids />} />
            <Route path="/guides/lake-geneva-schools" element={<LakeGenevaSchools />} />
            <Route path="/guides/cost-of-living-lake-geneva" element={<CostOfLivingLakeGeneva />} />
            <Route path="/guides/lake-geneva-vs-williams-bay" element={<LakeGenevaVsWilliamsBay />} />
            <Route path="/guides/fontana-vs-lake-geneva" element={<FontanaVsLakeGeneva />} />
            <Route path="/guides/why-people-love-lake-geneva" element={<WhyPeopleLoveLakeGeneva />} />
            <Route path="/guides/lake-geneva-shore-path" element={<LakeGenevaShorePath />} />
            <Route path="/guides/streblow-boats-geneva-lake" element={<StreblowBoats />} />
            <Route path="/guides/lake-geneva-public-access-guide" element={<LakeGenevaPublicAccess />} />
            <Route path="/guides/lake-geneva-faq" element={<LakeGenevaFAQ />} />
            <Route path="/market-report" element={<LakeGenevaMarketReport />} />
            <Route path="/best-of/restaurants-lake-geneva" element={<RestaurantsLakeGeneva />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="pipeline" element={<PipelineHealth />} />
              <Route path="content" element={<ContentQueue />} />
              <Route path="sources" element={<Sources />} />
              <Route path="sponsors" element={<Sponsors />} />
              <Route path="directory" element={<Directory />} />
              <Route path="coverage" element={<BusinessCoverage />} />
              <Route path="leads" element={<Leads />} />
              <Route path="newsletter" element={<Newsletter />} />
              <Route path="social-queue" element={<SocialQueue />} />
              <Route path="sponsor-analytics" element={<SponsorAnalytics />} />
              <Route path="image-test" element={<ImageTest />} />
              <Route path="engagement" element={<EngagementMonitor />} />
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="deals" element={<AdminDeals />} />
              <Route path="source-health" element={<SourceHealth />} />
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
