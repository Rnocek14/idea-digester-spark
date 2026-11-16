import { createFileRoute } from "@tanstack/react-router";
import EmployerDashboard from "@/pages/EmployerDashboard";

export const Route = createFileRoute("/employer-dashboard")({
  component: EmployerDashboard,
});
