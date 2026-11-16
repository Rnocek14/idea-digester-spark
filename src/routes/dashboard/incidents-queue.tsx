import { createFileRoute } from "@tanstack/react-router";
import IncidentsQueue from "@/pages/IncidentsQueue";

export const Route = createFileRoute("/dashboard/incidents-queue")({
  component: IncidentsQueue,
});
