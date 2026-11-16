import { createFileRoute } from "@tanstack/react-router";
import DashboardLayout from "@/components/DashboardLayout";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard – Lake Geneva Brief" }, { name: "robots", content: "noindex" }] }),
  component: () => <DashboardLayout />,
});
