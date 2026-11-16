import { createFileRoute } from "@tanstack/react-router";
import SponsorPortal from "@/pages/SponsorPortal";

export const Route = createFileRoute("/sponsor-portal")({
  component: SponsorPortal,
});
