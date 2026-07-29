import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HostnameRouter from "./components/HostnameRouter";
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
// Lazy-loaded: the legacy v1 homepage and the entire admin dashboard tree.
// These (plus recharts and other admin-only deps) were shipping in the public
// bundle to every reader; code-splitting them out is the biggest first-load win.
const LakeGeneva = lazy(() => import("./pages/LakeGeneva"));
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
import Auth from "./pages/Auth";
import Jobs from "./pages/Jobs";
import PostJob from "./pages/PostJob";
import Deals from "./pages/Deals";
// Niche portals, lazy-loaded: EmployerDashboard is the only route pulling
// recharts, which otherwise ships to every reader.
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const SponsorPortal = lazy(() => import("./pages/SponsorPortal"));
const AdminJobs = lazy(() => import("./pages/AdminJobs"));
const AdminDeals = lazy(() => import("./pages/AdminDeals"));
const BusinessCoverage = lazy(() => import("./pages/BusinessCoverage"));
const SourceHealth = lazy(() => import("./pages/SourceHealth"));
const PipelineHealth = lazy(() => import("./pages/PipelineHealth"));
const BusinessStories = lazy(() => import("./pages/BusinessStories"));
const HistoryEntries = lazy(() => import("./pages/HistoryEntries"));
const ContentAnalytics = lazy(() => import("./pages/ContentAnalytics"));
const ReaderFeedback = lazy(() => import("./pages/ReaderFeedback"));
const IncidentsQueue = lazy(() => import("./pages/IncidentsQueue"));
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
import BestOfLakeGeneva from "./pages/best-of/BestOfLakeGeneva";
import LakeGenevaShorePath from "./pages/guides/LakeGenevaShorePath";
import LakeGenevaShorePathStop from "./pages/guides/LakeGenevaShorePathStop";
import StreblowBoats from "./pages/guides/StreblowBoats";
import LakeGenevaPublicAccess from "./pages/guides/LakeGenevaPublicAccess";
import LakeGenevaFAQ from "./pages/guides/LakeGenevaFAQ";
import LakeGenevaWebcams from "./pages/guides/LakeGenevaWebcams";
import LakeGenevaWeather from "./pages/guides/LakeGenevaWeather";
import GuidesIndex from "./pages/guides/GuidesIndex";
import YerkesObservatory from "./pages/guides/YerkesObservatory";
import BigFootBeach from "./pages/guides/BigFootBeach";
import WhereToStayLakeGeneva from "./pages/guides/WhereToStayLakeGeneva";
import Today from "./pages/Today";
import StoryDetail from "./pages/StoryDetail";
import FindYourCity from "./pages/FindYourCity";
const DebugFeed = lazy(() => import("./pages/DebugFeed"));
import { About, Privacy, Terms } from "./pages/TrustPages";
const AdminCities = lazy(() => import("./pages/AdminCities"));

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
            <Route path="/cities" element={<FindYourCity />} />
            <Route path="/debug/feed" element={<DebugFeed />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
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
            <Route path="/guides" element={<GuidesIndex />} />
            <Route path="/guides/yerkes-observatory" element={<YerkesObservatory />} />
            <Route path="/guides/big-foot-beach-state-park" element={<BigFootBeach />} />
            <Route path="/guides/where-to-stay-lake-geneva" element={<WhereToStayLakeGeneva />} />
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
            <Route path="/guides/lake-geneva-shore-path/:slug" element={<LakeGenevaShorePathStop />} />
            <Route path="/guides/streblow-boats-geneva-lake" element={<StreblowBoats />} />
            <Route path="/guides/lake-geneva-public-access-guide" element={<LakeGenevaPublicAccess />} />
            <Route path="/guides/lake-geneva-faq" element={<LakeGenevaFAQ />} />
            <Route path="/lake-geneva-webcams" element={<LakeGenevaWebcams />} />
            <Route path="/lake-geneva-weather" element={<LakeGenevaWeather />} />
            <Route path="/market-report" element={<LakeGenevaMarketReport />} />
            <Route path="/best-of/restaurants-lake-geneva" element={<RestaurantsLakeGeneva />} />
            <Route path="/best-of/lake-geneva" element={<BestOfLakeGeneva />} />
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
              <Route path="cities" element={<AdminCities />} />
              <Route path="business-stories" element={<BusinessStories />} />
              <Route path="history" element={<HistoryEntries />} />
              <Route path="content-analytics" element={<ContentAnalytics />} />
              <Route path="reader-feedback" element={<ReaderFeedback />} />
              <Route path="incidents-queue" element={<IncidentsQueue />} />
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
