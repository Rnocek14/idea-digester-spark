import { createFileRoute } from "@tanstack/react-router";
import SourceHealth from "@/pages/SourceHealth";

export const Route = createFileRoute("/dashboard/source-health")({
  component: SourceHealth,
});
