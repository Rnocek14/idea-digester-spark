import { createFileRoute } from "@tanstack/react-router";
import AdminDeals from "@/pages/AdminDeals";

export const Route = createFileRoute("/dashboard/deals")({
  component: AdminDeals,
});
