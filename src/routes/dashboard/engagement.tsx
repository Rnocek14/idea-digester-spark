import { createFileRoute } from "@tanstack/react-router";
import EngagementMonitor from "@/pages/EngagementMonitor";

export const Route = createFileRoute("/dashboard/engagement")({
  component: EngagementMonitor,
});
