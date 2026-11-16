import { createFileRoute } from "@tanstack/react-router";
import AdminCities from "@/pages/AdminCities";

export const Route = createFileRoute("/dashboard/cities")({
  component: AdminCities,
});
