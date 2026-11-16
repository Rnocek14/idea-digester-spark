import { createFileRoute } from "@tanstack/react-router";
import Jobs from "@/pages/Jobs";

export const Route = createFileRoute("/jobs/")({
  component: Jobs,
});
