import { createFileRoute } from "@tanstack/react-router";
import Sponsors from "@/pages/Sponsors";

export const Route = createFileRoute("/dashboard/sponsors")({
  component: Sponsors,
});
