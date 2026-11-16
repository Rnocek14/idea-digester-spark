import { createFileRoute } from "@tanstack/react-router";
import Today from "@/pages/Today";

export const Route = createFileRoute("/today")({
  component: Today,
});
