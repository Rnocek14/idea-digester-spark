import { createFileRoute } from "@tanstack/react-router";
import BusinessCoverage from "@/pages/BusinessCoverage";

export const Route = createFileRoute("/dashboard/coverage")({
  component: BusinessCoverage,
});
