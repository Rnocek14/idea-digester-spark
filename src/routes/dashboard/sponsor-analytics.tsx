import { createFileRoute } from "@tanstack/react-router";
import SponsorAnalytics from "@/pages/SponsorAnalytics";

export const Route = createFileRoute("/dashboard/sponsor-analytics")({
  component: SponsorAnalytics,
});
