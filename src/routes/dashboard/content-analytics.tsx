import { createFileRoute } from "@tanstack/react-router";
import ContentAnalytics from "@/pages/ContentAnalytics";

export const Route = createFileRoute("/dashboard/content-analytics")({
  component: ContentAnalytics,
});
