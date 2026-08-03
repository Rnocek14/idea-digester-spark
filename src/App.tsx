import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HostnameRouter from "./components/HostnameRouter";
import LakeGenevaV2 from "./pages/LakeGenevaV2";
const LakeGenevaNightlife = lazy(() => import("./pages/LakeGenevaNightlife"));
const LakeGenevaEats = lazy(() => import("./pages/LakeGenevaEats"));
const FishFryGuide = lazy(() => import("./pages/FishFryGuide"));
const SellingLakeGeneva = lazy(() => import("./pages/SellingLakeGeneva"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const PublicDirectory = lazy(() => import("./pages/PublicDirectory"));
const Advertise = lazy(() => import("./pages/Advertise"));
const Incidents = lazy(() => import("./pages/Incidents"));
const IncidentDetail = lazy(() => import("./pages/IncidentDetail"));
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
const Auth = lazy(() => import("./pages/Auth"));
const Jobs = lazy(() => import("./pages/Jobs"));
const PostJob = lazy(() => import("./pages/PostJob"));
const Deals = lazy(() => import("./pages/Deals"));
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
const Submit = lazy(() => import("./pages/Submit"));
const CommunityLocalLove = lazy(() => import("./pages/CommunityLocalLove"));
const CommunityVoices = lazy(() => import("./pages/CommunityVoices"));
const ThingsToDoLakeGeneva = lazy(() => import("./pages/guides/ThingsToDoLakeGeneva"));
const MovingToLakeGeneva = lazy(() => import("./pages/guides/MovingToLakeGeneva"));
const LakeGenevaNeighborhoods = lazy(() => import("./pages/guides/LakeGenevaNeighborhoods"));
const ThisWeekendLakeGeneva = lazy(() => import("./pages/guides/ThisWeekendLakeGeneva"));
const WinterLakeGeneva = lazy(() => import("./pages/guides/WinterLakeGeneva"));
const LakeGenevaWinterfest = lazy(() => import("./pages/guides/LakeGenevaWinterfest"));
const SummerLakeGeneva = lazy(() => import("./pages/guides/SummerLakeGeneva"));
const LakeGenevaWithKids = lazy(() => import("./pages/guides/LakeGenevaWithKids"));
const LakeGenevaSchools = lazy(() => import("./pages/guides/LakeGenevaSchools"));
const LakeGenevaMarketReport = lazy(() => import("./pages/guides/LakeGenevaMarketReport"));
const CostOfLivingLakeGeneva = lazy(() => import("./pages/guides/CostOfLivingLakeGeneva"));
const LakeGenevaVsWilliamsBay = lazy(() => import("./pages/guides/LakeGenevaVsWilliamsBay"));
const FontanaVsLakeGeneva = lazy(() => import("./pages/guides/FontanaVsLakeGeneva"));
const WhyPeopleLoveLakeGeneva = lazy(() => import("./pages/guides/WhyPeopleLoveLakeGeneva"));
const RestaurantsLakeGeneva = lazy(() => import("./pages/best-of/RestaurantsLakeGeneva"));
const BestOfLakeGeneva = lazy(() => import("./pages/best-of/BestOfLakeGeneva"));
const LakeGenevaShorePath = lazy(() => import("./pages/guides/LakeGenevaShorePath"));
const LakeGenevaShorePathStop = lazy(() => import("./pages/guides/LakeGenevaShorePathStop"));
const LakeGenevaShorePathRegister = lazy(() => import("./pages/guides/LakeGenevaShorePathRegister"));
const LakeGenevaShorePathPassport = lazy(() => import("./pages/guides/LakeGenevaShorePathPassport"));
const StreblowBoats = lazy(() => import("./pages/guides/StreblowBoats"));
const LakeGenevaMailboat = lazy(() => import("./pages/guides/LakeGenevaMailboat"));
const LakeGenevaBoatRentals = lazy(() => import("./pages/guides/LakeGenevaBoatRentals"));
const LakeGenevaPublicAccess = lazy(() => import("./pages/guides/LakeGenevaPublicAccess"));
const LakeGenevaFAQ = lazy(() => import("./pages/guides/LakeGenevaFAQ"));
const LakeGenevaWebcams = lazy(() => import("./pages/guides/LakeGenevaWebcams"));
const LakeGenevaWeather = lazy(() => import("./pages/guides/LakeGenevaWeather"));
const GuidesIndex = lazy(() => import("./pages/guides/GuidesIndex"));
const YerkesObservatory = lazy(() => import("./pages/guides/YerkesObservatory"));
const BigFootBeach = lazy(() => import("./pages/guides/BigFootBeach"));
const WhereToStayLakeGeneva = lazy(() => import("./pages/guides/WhereToStayLakeGeneva"));
const Today = lazy(() => import("./pages/Today"));
const StoryDetail = lazy(() => import("./pages/StoryDetail"));
const FindYourCity = lazy(() => import("./pages/FindYourCity"));
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
            <Route path="/guides/lake-geneva-winterfest" element={<LakeGenevaWinterfest />} />
            <Route path="/guides/best-things-to-do-lake-geneva-in-summer" element={<SummerLakeGeneva />} />
            <Route path="/guides/things-to-do-lake-geneva-with-kids" element={<LakeGenevaWithKids />} />
            <Route path="/guides/lake-geneva-schools" element={<LakeGenevaSchools />} />
            <Route path="/guides/cost-of-living-lake-geneva" element={<CostOfLivingLakeGeneva />} />
            <Route path="/guides/lake-geneva-vs-williams-bay" element={<LakeGenevaVsWilliamsBay />} />
            <Route path="/guides/fontana-vs-lake-geneva" element={<FontanaVsLakeGeneva />} />
            <Route path="/guides/why-people-love-lake-geneva" element={<WhyPeopleLoveLakeGeneva />} />
            <Route path="/guides/lake-geneva-shore-path" element={<LakeGenevaShorePath />} />
            {/* Static segments must be declared before :slug so the register and
                passport aren't swallowed by the stop-detail route. */}
            <Route path="/guides/lake-geneva-shore-path/register" element={<LakeGenevaShorePathRegister />} />
            <Route path="/guides/lake-geneva-shore-path/passport" element={<LakeGenevaShorePathPassport />} />
            <Route path="/guides/lake-geneva-shore-path/:slug" element={<LakeGenevaShorePathStop />} />
            <Route path="/guides/streblow-boats-geneva-lake" element={<StreblowBoats />} />
            <Route path="/guides/lake-geneva-mailboat" element={<LakeGenevaMailboat />} />
            <Route path="/guides/lake-geneva-boat-rentals" element={<LakeGenevaBoatRentals />} />
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
