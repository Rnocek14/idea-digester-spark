import { createFileRoute } from "@tanstack/react-router";
import EventDetail from "@/pages/EventDetail";

export const Route = createFileRoute("/events/$id")({
  component: EventDetail,
});
