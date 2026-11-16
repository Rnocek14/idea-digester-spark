import { createFileRoute } from "@tanstack/react-router";
import { Privacy } from "@/pages/TrustPages";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});
