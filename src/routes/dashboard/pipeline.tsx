import { createFileRoute } from "@tanstack/react-router";
import PipelineHealth from "@/pages/PipelineHealth";

export const Route = createFileRoute("/dashboard/pipeline")({
  component: PipelineHealth,
});
