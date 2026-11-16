import { createFileRoute } from "@tanstack/react-router";
import AdminJobs from "@/pages/AdminJobs";

export const Route = createFileRoute("/dashboard/jobs")({
  component: AdminJobs,
});
