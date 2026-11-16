import { createFileRoute } from "@tanstack/react-router";
import BusinessesIndex from "@/pages/businesses/BusinessesIndex";

export const Route = createFileRoute("/businesses/")({
  component: BusinessesIndex,
});
