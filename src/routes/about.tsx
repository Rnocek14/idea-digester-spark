import { createFileRoute } from "@tanstack/react-router";
import { About } from "@/pages/TrustPages";

export const Route = createFileRoute("/about")({
  component: About,
});
