import { createFileRoute } from "@tanstack/react-router";
import { Terms } from "@/pages/TrustPages";

export const Route = createFileRoute("/terms")({
  component: Terms,
});
